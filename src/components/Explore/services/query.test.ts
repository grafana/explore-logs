import { timeRangeMock } from '../Context/__mocks__/timeRange';
import { Filter, FilterOp, FilterType } from '../Context/QueryContext';

import { LokiDatasource, LokiQueryType } from './lokiTypes';
import { buildDataQueryRequest, buildLabelFilter, buildLogSelector } from './query';

describe('buildDataQueryRequest', () => {
  test('should return a DataQueryRequest', () => {
    const queryExpr = '{job="grafana"}';
    const timeRange = timeRangeMock;
    const dataSource = {} as unknown as LokiDatasource;
    const result = buildDataQueryRequest(queryExpr, timeRangeMock, dataSource);

    expect(result).toEqual(
      expect.objectContaining({
        range: timeRange,
        scopedVars: {},
        timezone: 'browser',
        app: 'grafana-logs-app',
        targets: [
          {
            refId: 'A',
            expr: queryExpr,
            datasource: dataSource,
            queryType: LokiQueryType.Range,
          },
        ],
      })
    );
  });
});

const filters: Filter[] = [
  {
    key: 'place',
    values: ['luna', 'moon'],
    type: FilterType.IndexedLabel,
    op: FilterOp.Equal,
  },
  {
    key: 'age',
    values: ['new'],
    type: FilterType.IndexedLabel,
    op: FilterOp.NotEqual,
  },
  {
    key: 'stream',
    values: ['stderr'],
    type: FilterType.NonIndexedLabel,
    op: FilterOp.Equal,
  },
  {
    key: 'level',
    values: ['error'],
    type: FilterType.NonIndexedLabel,
    op: FilterOp.NotEqual,
  },
];

describe('buildLogSelectorString', () => {
  test('Builds a stream selector from indexed labels', () => {
    expect(buildLogSelector(filters)).toBe('{age!="new",place=~"(luna|moon)"}');
  });
});

describe('buildLabelFilters', () => {
  test('Builds label filters from non-indexed labels', () => {
    expect(buildLabelFilter(filters)).toBe('stream=`stderr` | level!=`error`');
  });
});
