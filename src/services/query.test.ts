import { AdHocVariableFilter } from '@grafana/data';
import { buildDataQuery, renderLogQLFieldFilters, renderLogQLLabelFilters } from './query';
import { FilterOp } from './filters';

import { FieldValue } from './variables';

describe('buildDataQuery', () => {
  test('Given an expression outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}')).toEqual({
      editorMode: 'code',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'A',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });

  test('Given an expression and overrides outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}', { editorMode: 'gpt', refId: 'C' })).toEqual({
      editorMode: 'gpt',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'C',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });
});

describe('renderLogQLFieldFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level=`info` | cluster=`lil-cluster`');
  });

  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level!=`info` | cluster!=`lil-cluster`');
  });

  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'error',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level=`info` or level=`error`');
  });

  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'comp1',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'error',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'pod1',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| level=`info` or level=`error` | cluster=`lil-cluster` | component!=`comp1` | pod!=`pod1`'
    );
  });
});

describe('renderLogQLLabelFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level=`info`, cluster=`lil-cluster`');
  });

  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level!=`info`, cluster!=`lil-cluster`');
  });

  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level=~"info|error"');
  });

  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'level=~"info|error", cluster=`lil-cluster`, component!=`comp1`, pod!=`pod1`'
    );
  });
});
