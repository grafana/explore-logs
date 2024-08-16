import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, DataSourceApi } from '@grafana/data';
import { LokiQuery } from './query';
import { addShardingPlaceholderSelector, interpolateShardingSelector, isLogsQuery } from './logql';
import { combineResponses } from './combineResponses';

/**
 * Based in the state of the current response, if any, adjust target parameters such as `maxLines`.
 * For `maxLines`, we will update it as `maxLines - current amount of lines`.
 * At the end, we will filter the targets that don't need to be executed in the next request batch,
 * becasue, for example, the `maxLines` have been reached.
 */
function adjustTargetsFromResponseState(targets: LokiQuery[], response: DataQueryResponse | null): LokiQuery[] {
  if (!response) {
    return targets;
  }

  return targets
    .map((target) => {
      if (!target.maxLines || !isLogsQuery(target.expr)) {
        return target;
      }
      const targetFrame = response.data.find((frame) => frame.refId === target.refId);
      if (!targetFrame) {
        return target;
      }
      const updatedMaxLines = target.maxLines - targetFrame.length;
      return {
        ...target,
        maxLines: updatedMaxLines < 0 ? 0 : updatedMaxLines,
      };
    })
    .filter((target) => target.maxLines === undefined || target.maxLines > 0);
}

export function splitQueriesByStreamShard(
  datasource: DataSourceApi,
  request: DataQueryRequest<LokiQuery>,
  splittingTargets: LokiQuery[],
  nonSplittingTargets: LokiQuery[] = []
) {
  let endShard = 0;
  let shouldStop = false;
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming, key: uuidv4() };
  let subquerySubsciption: Subscription | null = null;

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, shard?: number) => {
    if (shouldStop) {
      subscriber.complete();
      return;
    }

    const done = () => {
      mergedResponse.state = LoadingState.Done;
      subscriber.next(mergedResponse);
      subscriber.complete();
    };

    const nextRequest = () => {
      if (!shard) {
        done();
        return;
      }
      const nextShard = shard + 1;
      if (nextShard <= endShard) {
        runNextRequest(subscriber, nextShard);
        return;
      }
      done();
    };

    const targets = adjustTargetsFromResponseState(splittingTargets, mergedResponse);
    if (!targets.length) {
      nextRequest();
      return;
    }

    const subRequest = { ...request, targets: interpolateShardingSelector(targets, shard) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId = `${request.requestId}_shard_${shard}`;
    }

    // @ts-expect-error
    subquerySubsciption = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        mergedResponse = combineResponses(mergedResponse, partialResponse);
        if ((mergedResponse.errors ?? []).length > 0 || mergedResponse.error != null) {
          shouldStop = true;
        }
      },
      complete: () => {
        subscriber.next(mergedResponse);
        nextRequest();
      },
      error: (error: unknown) => {
        console.error(error);
        subscriber.next(mergedResponse);
        nextRequest();
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    datasource.languageProvider
      .fetchLabelValues('__stream_shard__', { timeRange: request.range })
      .then((values: string[]) => {
        values.forEach((shard) => {
          if (parseInt(shard, 10) > endShard) {
            endShard = parseInt(shard, 10);
          }
        });
        if (endShard === 0) {
          console.warn(`Shard splitting not supported. Issuing a regular query.`);
          runNextRequest(subscriber);
        } else {
          console.log(`Querying up to ${endShard} shards`);
          runNextRequest(subscriber, -1);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        shouldStop = true;
        runNextRequest(subscriber, 0);
      });
    return () => {
      shouldStop = true;
      if (subquerySubsciption != null) {
        subquerySubsciption.unsubscribe();
      }
    };
  });

  return response;
}

export function runShardSplitQuery(datasource: DataSourceApi, request: DataQueryRequest<LokiQuery>) {
  const queries = request.targets
    // @ts-expect-error
    .filter((query) => !query.hide)
    .filter((query) => query.expr)
    .map((target) => ({
      ...target,
      expr: addShardingPlaceholderSelector(target.expr),
    }));

  return splitQueriesByStreamShard(datasource, request, queries, []);
}
