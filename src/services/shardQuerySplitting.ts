import { Observable, Subscriber, Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

import { DataQueryRequest, LoadingState, DataQueryResponse, QueryResultMetaStat } from '@grafana/data';
import { addShardingPlaceholderSelector, getSelectorForShardValues, interpolateShardingSelector } from './logql';
import { combineResponses } from './combineResponses';
import { DataSourceWithBackend } from '@grafana/runtime';
import { LokiQuery } from './lokiQuery';
import { logger } from './logger';

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
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const runNextRequest = (
    subscriber: Subscriber<DataQueryResponse>,
    cycle: number,
    shards: number[],
    groupSize: number
  ) => {
    let nextGroupSize = groupSize;
    if (subquerySubscription != null) {
      subquerySubscription.unsubscribe();
      subquerySubscription = null;
    }

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
      const nextCycle = Math.min(cycle + groupSize, shards.length);
      if (cycle < shards.length && nextCycle <= shards.length) {
        runNextRequest(subscriber, nextCycle, shards, nextGroupSize);
        return;
      }
      done();
    };

    const retry = (errorResponse?: DataQueryResponse) => {
      if (errorResponse?.errors && errorResponse.errors[0].message?.includes('maximum of series')) {
        logger.info(`Maximum series reached, skipping retry`);
        return false;
      } else if (errorResponse?.errors && errorResponse.errors[0].message?.includes('parse error')) {
        logger.info(`Parse error, skipping retry`);
        shouldStop = true;
        return false;
      }

      if (groupSize > 1) {
        groupSize = Math.floor(Math.sqrt(groupSize));
        debug(`Possible time out, new group size ${groupSize}`);
        runNextRequest(subscriber, cycle, shards, groupSize);
        return true;
      }

      const retries = retriesMap.get(cycle) ?? 0;
      if (retries > 3) {
        shouldStop = true;
        return false;
      }

      retriesMap.set(cycle, retries + 1);

      retryTimer = setTimeout(() => {
        logger.info(`Retrying ${cycle} (${retries + 1})`);
        runNextRequest(subscriber, cycle, shards, groupSize);
        retryTimer = null;
      }, 1500 * Math.pow(2, retries)); // Exponential backoff

      return true;
    };

    const shardsToQuery = groupShardRequests(shards, cycle, groupSize);
    debug(`Querying ${shardsToQuery.join(', ')}`);
    const subRequest = { ...request, targets: interpolateShardingSelector(splittingTargets, shardsToQuery) };
    // Request may not have a request id
    if (request.requestId) {
      subRequest.requestId = `${request.requestId}_shard_${cycle}_${groupSize}`;
    }

    // @ts-expect-error
    subquerySubscription = datasource.runQuery(subRequest).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        if ((partialResponse.errors ?? []).length > 0 || partialResponse.error != null) {
          if (retry(partialResponse)) {
            return;
          }
        }
        nextGroupSize = updateGroupSizeFromResponse(partialResponse, groupSize);
        if (nextGroupSize !== groupSize) {
          debug(`New group size ${nextGroupSize}`);
        }
        mergedResponse = combineResponses(mergedResponse, partialResponse);
      },
      complete: () => {
        // Prevent flashing "no data"
        if (mergedResponse.data.length) {
          subscriber.next(mergedResponse);
        }
        nextRequest();
      },
      error: (error: unknown) => {
        logger.error(error, { msg: 'failed to shard' });
        subscriber.next(mergedResponse);
        if (retry()) {
          return;
        }
        nextRequest();
      },
    });
  };

  const runNonSplitRequest = (subscriber: Subscriber<DataQueryResponse>) => {
    // @ts-expect-error
    subquerySubscription = datasource.runQuery(request).subscribe({
      next: (partialResponse: DataQueryResponse) => {
        mergedResponse = partialResponse;
      },
      complete: () => {
        subscriber.next(mergedResponse);
      },
      error: (error: unknown) => {
        logger.error(error, { msg: 'runNonSplitRequest subscription error' });
        subscriber.error(mergedResponse);
      },
    });
  };

  const response = new Observable<DataQueryResponse>((subscriber) => {
    const selector = getSelectorForShardValues(splittingTargets[0].expr);
    datasource.languageProvider
      .fetchLabelValues('__stream_shard__', {
        timeRange: request.range,
        streamSelector: selector ? selector : undefined,
      })
      .then((values: string[]) => {
        const shards = values.map((value) => parseInt(value, 10));
        if (!shards || !shards.length) {
          logger.warn(`Shard splitting not supported. Issuing a regular query.`);
          runNonSplitRequest(subscriber);
        } else {
          shards.sort((a, b) => b - a);
          debug(`Querying ${shards.join(', ')} shards`);
          runNextRequest(subscriber, 0, shards, getInitialGroupSize(shards));
        }
      })
      .catch((e: unknown) => {
        logger.error(e, { msg: 'failed to fetch label values for __stream_shard__' });
        shouldStop = true;
        runNonSplitRequest(subscriber);
      });
    return () => {
      shouldStop = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      if (subquerySubscription != null) {
        subquerySubscription.unsubscribe();
        subquerySubscription = null;
      }
    };
  });

  return response;
}

function updateGroupSizeFromResponse(response: DataQueryResponse, currentSize: number) {
  if (!response.data.length) {
    // Empty response, increase group size
    return currentSize + 1;
  }

  const metaExecutionTime: QueryResultMetaStat | undefined = response.data[0].meta?.stats?.find(
    (stat: QueryResultMetaStat) => stat.displayName === 'Summary: exec time'
  );

  if (metaExecutionTime) {
    debug(`${metaExecutionTime.value}`);
    // Positive scenarios
    if (metaExecutionTime.value < 1) {
      return currentSize * 2;
    } else if (metaExecutionTime.value < 6) {
      return currentSize + 2;
    } else if (metaExecutionTime.value < 16) {
      return currentSize + 1;
    }

    // Negative scenarios
    if (currentSize === 1) {
      return currentSize;
    } else if (metaExecutionTime.value < 20) {
      return currentSize - 1;
    } else {
      return Math.floor(currentSize / 2);
    }
  }

  return currentSize;
}

function groupShardRequests(shards: number[], start: number, groupSize: number) {
  if (start === shards.length) {
    return [-1];
  }
  return shards.slice(start, start + groupSize);
}

function getInitialGroupSize(shards: number[]) {
  return Math.floor(Math.sqrt(shards.length));
}

// Enable to output debugging logs
const DEBUG_ENABLED = true;
function debug(message: string) {
  if (!DEBUG_ENABLED) {
    return;
  }
  console.log(message);
}
