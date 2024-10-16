import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, LoadingState } from '@grafana/data';

import { runShardSplitQuery } from './shardQuerySplitting';
import { DataSourceWithBackend } from '@grafana/runtime';

import { LokiQuery } from './lokiQuery';
import { getMockFrames } from './combineResponses.test';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid'),
}));

const originalLog = console.log;
const originalWarn = console.warn;
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  console.log = originalLog;
  console.warn = originalWarn;
});

describe('runShardSplitQuery()', () => {
  let datasource: DataSourceWithBackend<LokiQuery>;
  const range = {
    from: dateTime('2023-02-08T04:00:00.000Z'),
    to: dateTime('2023-02-08T11:00:00.000Z'),
    raw: {
      from: dateTime('2023-02-08T04:00:00.000Z'),
      to: dateTime('2023-02-08T11:00:00.000Z'),
    },
  };

  const createRequest = (targets: Array<Partial<LokiQuery>>, overrides?: Partial<DataQueryRequest<LokiQuery>>) => {
    let request = {
      range,
      targets,
      intervalMs: 60000,
      requestId: 'TEST',
    } as DataQueryRequest<LokiQuery>;

    Object.assign(request, overrides);
    return request;
  };
  let request: DataQueryRequest<LokiQuery>;
  beforeEach(() => {
    request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }]);
    datasource = createLokiDatasource();
    datasource.languageProvider.fetchLabelValues.mockResolvedValue(['1', '10', '2', '20', '3']);
    const { metricFrameA } = getMockFrames();
    // @ts-expect-error
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [metricFrameA] }));
    jest.spyOn(datasource, 'query').mockReturnValue(of({ data: [metricFrameA] }));
  });

  test('Splits datasource queries', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
    });
  });

  test('Does not report missing data while streaming', async () => {
    // @ts-expect-error
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ status: 200, data: [] }));
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 4 shard requests
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
      expect(response).toHaveLength(1);
    });
  });

  test('Does not run invalid queries', async () => {
    request.targets[0].expr = '{ ,insight != ""}';
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(0);
    });
  });

  test('Interpolates queries before running', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"20|10"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_2_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"3|2"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_4_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="1"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_5_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
      });
    });
  });

  test('Sends the whole stream selector to fetch values', async () => {
    datasource.interpolateVariablesInQueries = jest.fn().mockImplementation((queries: LokiQuery[]) => {
      return queries.map((query) => {
        query.expr = query.expr.replace('$SELECTOR', '{service_name="test", filter="true"}');
        return query;
      });
    });

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.languageProvider.fetchLabelValues).toHaveBeenCalledWith('__stream_shard__', {
        streamSelector: '{service_name="test", filter="true"}',
        timeRange: expect.anything(),
      });

      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_2',
        targets: [
          { expr: 'count_over_time({service_name="test", filter="true", __stream_shard__=~"20|10"}[1m])', refId: 'A' },
        ],
      });
    });
  });

  test('Returns a DataQueryResponse with the expected attributes', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      expect(response[0].data).toBeDefined();
      expect(response[0].state).toBe(LoadingState.Done);
      expect(response[0].key).toBeDefined();
    });
  });

  test('Retries failed requests', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue(['1']);
    jest
      // @ts-expect-error
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
    // @ts-expect-error
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback) => {
      callback();
    });
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 1 shard + empty shard + 1 retry = 3
      expect(response).toHaveLength(3);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });

  test('Adjusts the group size based on errors and execution time', async () => {
    const request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }], {
      range: {
        from: dateTime('2024-11-13T05:00:00.000Z'),
        to: dateTime('2024-11-14T06:00:00.000Z'),
        raw: {
          from: dateTime('2024-11-13T05:00:00.000Z'),
          to: dateTime('2024-11-14T06:00:00.000Z'),
        },
      },
    });

    datasource.languageProvider.fetchLabelValues.mockResolvedValue([
      '1',
      '10',
      '2',
      '20',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
    ]);

    // @ts-expect-error
    jest.spyOn(global, 'setTimeout').mockImplementationOnce((callback) => {
      callback();
    });

    const { metricFrameA } = getMockFrames();

    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReset();

    // + 50%
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.5,
                },
              ],
            },
          },
        ],
      })
    );

    // sqrt(currentSize)
    jest
      // @ts-expect-error
      .mocked(datasource.runQuery)
      .mockReturnValueOnce(of({ state: LoadingState.Error, error: { refId: 'A', message: 'timeout' }, data: [] }));

    // +10%
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 5,
                },
              ],
            },
          },
        ],
      })
    );

    // -10%
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 15,
                },
              ],
            },
          },
        ],
      })
    );

    // -10%
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 19,
                },
              ],
            },
          },
        ],
      })
    );

    // -50%
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValueOnce(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 21,
                },
              ],
            },
          },
        ],
      })
    );

    // No more than 50% of the remaining shards
    // @ts-expect-error
    jest.mocked(datasource.runQuery).mockReturnValue(
      of({
        data: [
          {
            ...metricFrameA,
            meta: {
              ...metricFrameA.meta,
              stats: [
                ...metricFrameA.meta!.stats!,
                {
                  displayName: 'Summary: exec time',
                  unit: 's',
                  value: 0.5,
                },
              ],
            },
          },
        ],
      })
    );

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"20|10|9"}[1m])', refId: 'A' }],
      });

      // +50%
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3_4',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"8|7|6|5"}[1m])', refId: 'A' }],
      });

      // Error, sqrt(currentSize)
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"8|7"}[1m])', refId: 'A' }],
      });

      // +10%
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_5_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"6|5|4"}[1m])', refId: 'A' }],
      });

      // -10%
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_8_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"3|2"}[1m])', refId: 'A' }],
      });

      // No more than 50% of the remaining shards
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_10_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__="1"}[1m])', refId: 'A' }],
      });

      // No more than 50% of the remaining shards
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_11_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
      });
    });
  });
});

function createLokiDatasource() {
  return {
    query: jest.fn(),
    runQuery: jest.fn(),
    interpolateVariablesInQueries: jest.fn().mockImplementation((queries: LokiQuery[]) => {
      return queries.map((query) => {
        query.expr = query.expr.replace('$SELECTOR', '{a="b"}');
        return query;
      });
    }),
    languageProvider: {
      fetchLabelValues: jest.fn(),
    },
  } as unknown as DataSourceWithBackend<LokiQuery>;
}
