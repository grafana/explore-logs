import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, TimeRange } from '@grafana/data';
import { LokiQuery } from './query';
import {
  addShardingPlaceholderSelector,
  getServiceNameFromQuery,
  interpolateShardingSelector,
  isLogsQuery,
} from './logql';
import { combineResponses } from './combineResponses';
import { DataSourceWithBackend } from '@grafana/runtime';

/**
 * Query splitting by stream shards.
 * Query splitting was introduced in Loki to optimize querying for long intervals and high volume of data,
 * dividing a big request into smaller sub-requests, combining and displaying the results as they arrive.
 *
 * This approach, inspired by the time-based query splitting, takes advantage of the __stream_shard__
 * internal label, representing how data is spread into different sources that can be queried individually.
 *
 * The main entry point of this module is runShardSplitQuery(), which prepares the query for execution and
 * passes it to splitQueriesByStreamShard() to begin the querying loop.
 *
 * splitQueriesByStreamShard() has the following structure:
 * - Creates and returns an Observable to which the UI will subscribe
 * - Requests the __stream_shard__ values of the selected service:
 *   . If there are no shard values, it falls back to the standard querying approach of the data source in runNonSplitRequest()
 *   . If there are shards:
 *     - It groups the shard requests in an array of arrays of shard numbers in groupShardRequests()
 *     - It begins the querying loop with runNextRequest()
 * - runNextRequest() will send a query using the nth (cycle) shard group, and has the following internal structure:
 *   . adjustTargetsFromResponseState() will filter log queries targets that already received the requested maxLines
 *   . interpolateShardingSelector() will update the stream selector with the current shard numbers
 *   . After query execution:
 *     - If the response is successful:
 *       . It will add new data to the response with combineResponses()
 *       . nextRequest() will use the current cycle and the total groups to determine the next request or complete execution with done()
 *     - If the response is unsuccessful:
 *       . If there are retry attempts, it will retry the current cycle, or else continue with the next cycle
 *       . If the returned error is Maximum series reached, it will not retry
 * - Once all request groups have been executed, it will be done()
 */

export function runShardSplitQuery(datasource: DataSourceWithBackend<LokiQuery>, request: DataQueryRequest<LokiQuery>) {
  const queries = datasource
    .interpolateVariablesInQueries(request.targets, request.scopedVars)
    .filter((query) => query.expr)
    .map((target) => ({
      ...target,
      expr: addShardingPlaceholderSelector(target.expr),
    }));

  return splitQueriesByStreamShard(datasource, request, queries);
}

function splitQueriesByStreamShard(
  datasource: DataSourceWithBackend<LokiQuery>,
  request: DataQueryRequest<LokiQuery>,
  splittingTargets: LokiQuery[]
) {
  let shouldStop = false;
  let mergedResponse: DataQueryResponse = { data: [], state: LoadingState.Streaming, key: uuidv4() };
  let subquerySubscription: Subscription | null = null;
  let retriesMap = new Map<number, number>();

  const runNextRequest = (subscriber: Subscriber<DataQueryResponse>, cycle: number, shardRequests: number[][]) => {
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
      const nextCycle = cycle + 1;
      if (nextCycle < shardRequests.length) {
        runNextRequest(subscriber, nextCycle, shardRequests);
        return;
      }
      done();
    };

    const retry = (errorResponse?: DataQueryResponse) => {
      if (errorResponse?.errors && errorResponse.errors[0].message?.includes('maximum of series')) {
        console.log(`Maximum series reached, skipping retry`);
        return false;
      }

      const retries = retriesMap.get(cycle) ?? 0;
      if (retries > 2) {
        return false;
      }

      retriesMap.set(cycle, retries + 1);

      console.log(`Retrying ${cycle} (${retries + 1})`);
      runNextRequest(subscriber, cycle, shardRequests);
      return true;
    };

    const targets = adjustTargetsFromResponseState(splittingTargets, mergedResponse);
    if (!targets.length) {
      nextRequest();
      return;
    }

    const subRequest = { ...request, targets: interpolateShardingSelector(targets, shardRequests, cycle) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId = `${request.requestId}_shard_${cycle}`;
    }

    // @ts-expect-error
    subquerySubscription = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
          }
        }
        mergedResponse = combineResponses(mergedResponse, partialResponse);
      },
      complete: () => {
        subscriber.next(mergedResponse);
        nextRequest();
      },
      error: (error: unknown) => {
        console.error(error);
        subscriber.next(mergedResponse);
        if (retry()) {
          return;
        }
        nextRequest();
      },
    });
  };

  const runNonSplitRequest = (subscriber: Subscriber<DataQueryResponse>) => {
    subquerySubscription = datasource.query(request).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        mergedResponse = partialResponse;
      },
      complete: () => {
        subscriber.next(mergedResponse);
      },
      error: (error: unknown) => {
        console.error(error);
        subscriber.error(mergedResponse);
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    const serviceName = getServiceNameFromQuery(splittingTargets[0].expr);
    datasource.languageProvider
      .fetchLabelValues('__stream_shard__', {
        timeRange: request.range,
        streamSelector: serviceName ? `{service_name=${serviceName}}` : undefined,
      })
      .then((values: string[]) => {
        const shards = values.map((value) => parseInt(value, 10));
        if (!shards || !shards.length) {
          console.warn(`Shard splitting not supported. Issuing a regular query.`);
          runNonSplitRequest(subscriber);
        } else {
          const shardRequests = groupShardRequests(shards, request.range);
          console.log(`Querying ${shards.join(', ')} shards`);
          runNextRequest(subscriber, 0, shardRequests);
        }
      })
      .catch((e: unknown) => {
        console.error(e);
        shouldStop = true;
        runNonSplitRequest(subscriber);
      });
    return () => {
      shouldStop = true;
      if (subquerySubscription != null) {
        subquerySubscription.unsubscribe();
      }
    };
  });

  return response;
}

function groupShardRequests(shards: number[], range: TimeRange) {
  const hours = range.to.diff(range.from, 'hour');

  shards.sort((a, b) => a - b);
  const maxRequests = calculateMaxRequests(shards.length);
  const groupSize = Math.ceil(shards.length / maxRequests);
  const requests: number[][] = [];
  for (let i = shards.length - 1; i >= 0; i -= groupSize) {
    const request: number[] = [];
    for (let j = i; j > i - groupSize && j >= 0; j -= 1) {
      request.push(shards[j]);
    }
    requests.push(request);
  }

  // With shorter intervals, this gives a similar UX to non-sharded requests.
  if (hours <= 6) {
    requests.push([-1]);
    requests.reverse();
  } else {
    requests.push([-1]);
  }

  return requests;
}

/**
 * Simple approach to calculate a maximum amount of requests to send based on
 * the available shards, preventing an excessive number of sub-requests per query.
 * For example:
 * Shards => Requests
 *   1    =>   1
 *   2    =>   1
 *   4    =>   2
 *   8    =>   3
 *   16   =>   4
 *   32   =>   6
 *   64   =>   8
 *   128  =>   12
 */
function calculateMaxRequests(shards: number) {
  return Math.max(Math.min(Math.ceil(Math.sqrt(shards)), shards - 1), 1);
}

/**
 * Based in the state of the current response, if any, adjust target parameters such as `maxLines`.
 * For `maxLines`, we will update it as `maxLines - current amount of lines`.
 * At the end, we will filter the targets that don't need to be executed in the next request batch,
 * because, for example, the `maxLines` have been reached.
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
