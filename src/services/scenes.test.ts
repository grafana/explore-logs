import { sceneGraph } from '@grafana/scenes';

import { LineFilter } from 'Components/ServiceScene/LineFilter';
import { getUniqueFilters } from './scenes';
import { VAR_FIELDS, VAR_FILTERS } from './variables';

jest.mock('@grafana/scenes');

describe('getUniqueFilters', () => {
  const scene = new LineFilter();
  test('Returns unique keywords that have not been used in filters or fields', () => {
    jest.mocked(sceneGraph.lookupVariable).mockImplementation((variable: string) => {
      if (variable === VAR_FILTERS) {
        const filter = new (jest.requireActual('@grafana/scenes').AdHocFiltersVariable)({
          name: variable,
          filterExpression: jest.fn(),
          filters: [{ key: 'service_name' }],
        });
        return filter;
      } else if (variable === VAR_FIELDS) {
        const filter = new (jest.requireActual('@grafana/scenes').AdHocFiltersVariable)({
          name: variable,
          filterExpression: jest.fn(),
          filters: [{ key: 'level' }, { key: 'cluster' }],
        });
        return filter;
      }
      const filter = new (jest.requireActual('@grafana/scenes').AdHocFiltersVariable)({
        name: variable,
        filterExpression: jest.fn(),
        filters: [],
      });
      return filter;
    });

    const filters = ['place', 'service_name', 'namespace', 'cluster', 'pod', 'level'];
    expect(getUniqueFilters(scene, filters)).toEqual(['place', 'namespace', 'pod']);
  });
});
