import { of } from 'rxjs';

import { DataQueryRequest, DataQueryResponse, dateTime, LoadingState } from '@grafana/data';

import { runShardSplitQuery } from './shardQuerySplitting';
import { DataSourceWithBackend } from '@grafana/runtime';

import { LokiQuery } from './query';

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
    from: dateTime('2023-02-08T05:00:00.000Z'),
    to: dateTime('2023-02-10T06:00:00.000Z'),
    raw: {
      from: dateTime('2023-02-08T05:00:00.000Z'),
      to: dateTime('2023-02-10T06:00:00.000Z'),
    },
  };

  const createRequest = (targets: Array<Partial<LokiQuery>>, overrides?: Partial<DataQueryRequest<LokiQuery>>) => {
    const request = {
      range,
      targets,
      intervalMs: 60000,
      requestId: 'TEST',
    } as DataQueryRequest<LokiQuery>;

    Object.assign(request, overrides);
    return request;
  };
  const request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }]);
  beforeEach(() => {
    datasource = createLokiDatasource();
    datasource.languageProvider.fetchLabelValues.mockResolvedValue(['1', '10', '2', '20', '3']);
    // @ts-expect-error
    jest.spyOn(datasource, 'runQuery').mockReturnValue(of({ data: [] }));
    jest.spyOn(datasource, 'query').mockReturnValue(of({ data: [] }));
  });

  test('Splits datasource queries', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
    });
  });

  test('Interpolates queries before running', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"20|10"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"3|2"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"1"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
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
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue([1]);
    jest
      // @ts-expect-error
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 1 shard + empty shard + 1 retry = 3
      expect(response).toHaveLength(3);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });

  test('Retries failed requests', async () => {
    jest.mocked(datasource.languageProvider.fetchLabelValues).mockResolvedValue([1]);
    jest
      // @ts-expect-error
      .spyOn(datasource, 'runQuery')
      .mockReturnValueOnce(of({ state: LoadingState.Error, error: { refId: 'A', message: 'Error' }, data: [] }));
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith((response: DataQueryResponse[]) => {
      // 1 shard + empty shard + 1 retry = 3
      expect(response).toHaveLength(3);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(3);
    });
  });

  test('For small time ranges starts with the highest volume shards', async () => {
    const request = createRequest([{ expr: 'count_over_time($SELECTOR[1m])', refId: 'A' }], {
      range: {
        from: dateTime('2024-11-13T05:00:00.000Z'),
        to: dateTime('2024-11-13T06:00:00.000Z'),
        raw: {
          from: dateTime('2024-11-13T05:00:00.000Z'),
          to: dateTime('2024-11-13T06:00:00.000Z'),
        },
      },
    });

    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      expect(datasource.interpolateVariablesInQueries).toHaveBeenCalledTimes(1);
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_0',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=""}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_1',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"1"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_2',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"3|2"}[1m])', refId: 'A' }],
      });
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledWith({
        intervalMs: expect.any(Number),
        range: expect.any(Object),
        requestId: 'TEST_shard_3',
        targets: [{ expr: 'count_over_time({a="b", __stream_shard__=~"20|10"}[1m])', refId: 'A' }],
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
