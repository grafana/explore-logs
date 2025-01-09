import { AdHocFiltersVariable, sceneGraph, SceneObject } from '@grafana/scenes';
import { VAR_FIELDS, VAR_LABEL_GROUP_BY_EXPR } from '../../../services/variables';
import { buildLabelsQuery } from '../../../services/labels';

describe('buildLabelsQuery', () => {
  test('should build no-parser query with no filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [],
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build no-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [
        {
          value: JSON.stringify({ value: 'cluster-value', parser: 'structuredMetadata' }),
          operator: '=',
          key: 'cluster',
        },
        {
          value: JSON.stringify({ value: 'pod-value', parser: 'structuredMetadata' }),
          operator: '=',
          key: 'pod',
        },
      ],
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build logfmt-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [
        {
          value: JSON.stringify({ value: 'cluster-value', parser: 'logfmt' }),
          operator: '=',
          key: 'cluster',
        },
        {
          value: JSON.stringify({ value: 'pod-value', parser: 'structuredMetadata' }),
          operator: '=',
          key: 'pod',
        },
      ],
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | logfmt  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build json-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [
        {
          value: JSON.stringify({ value: 'cluster-value', parser: 'json' }),
          operator: '=',
          key: 'cluster',
        },
        {
          value: JSON.stringify({ value: 'pod-value', parser: 'structuredMetadata' }),
          operator: '=',
          key: 'pod',
        },
      ],
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | json | drop __error__, __error_details__  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
  test('should build mixed-parser query with structured metadata filters', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [
        {
          value: JSON.stringify({ value: 'cluster-value', parser: 'logfmt' }),
          operator: '=',
          key: 'cluster',
        },
        {
          value: JSON.stringify({ value: 'pod-value', parser: 'structuredMetadata' }),
          operator: '=',
          key: 'pod',
        },
        {
          value: JSON.stringify({
            value: JSON.stringify({ error: { msg: 'oh no!', level: 'critical' } }),
            parser: 'json',
          }),
          operator: '=',
          key: 'stacktrace',
        },
      ],
    });
    jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(filterVariable);

    const result = buildLabelsQuery({} as SceneObject, VAR_LABEL_GROUP_BY_EXPR, 'cluster');
    expect(result).toMatchObject({
      expr: `sum(count_over_time({\${filters} ,cluster != ""}  \${levels} \${metadata} \${patterns} \${lineFilters} | json | logfmt | drop __error__, __error_details__  \${fields} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
    });
  });
});
