import { of } from 'rxjs';

import { DataQueryRequest, dateTime } from '@grafana/data';

import { runShardSplitQuery } from './shardQuerySplitting';
import { DataSourceWithBackend } from '@grafana/runtime';

import { LokiQuery } from './query';

jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('uuid'),
}));

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
    });
  });

  test('Splits datasource queries', async () => {
    await expect(runShardSplitQuery(datasource, request)).toEmitValuesWith(() => {
      // 5 shards, 3 groups + empty shard group, 4 requests
      // @ts-expect-error
      expect(datasource.runQuery).toHaveBeenCalledTimes(4);
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
