import { AdHocFiltersVariable } from '@grafana/scenes';
import { VAR_FIELDS, VAR_LABELS, VAR_METADATA } from './variables';
import { FilterOp } from './filterTypes';
import { getVisibleFilters } from './labels';
import { VAR_FIELD_NAME } from '@grafana/data';
import SpyInstance = jest.SpyInstance;

describe('getVisibleFilters', () => {
  let logSpy: SpyInstance;
  beforeEach(() => {
    logSpy = jest.spyOn(global.console, 'error');
  });
  afterEach(() => {
    // If a field does not properly encode the value we will throw a console error, but it will still return a "proper" value.
    // We want the test to fail in this case
    expect(logSpy).toHaveBeenCalledTimes(0);
  });
  describe('labels', () => {
    it('Returns an empty array when everything is empty', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [],
      });
      expect(getVisibleFilters('', [], labelsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [],
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_LABELS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
  describe('fields', () => {
    it('Returns an empty array when everything is empty', () => {
      const fieldsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [],
      });
      expect(getVisibleFilters('', [], fieldsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [],
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: 'error',
              parser: 'logfmt',
            }),
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: 'error',
              parser: 'logfmt',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: 'warn',
              parser: 'logfmt',
            }),
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              value: 'info',
              parser: 'logfmt',
            }),
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: 'error',
              parser: 'logfmt',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: 'warn',
              parser: 'logfmt',
            }),
            valueLabels: ['error'],
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              value: 'info',
              parser: 'logfmt',
            }),
            valueLabels: ['info'],
          },
        ],
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: JSON.stringify({
              value: '""',
              parser: 'logfmt',
            }),
            valueLabels: ['""'],
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELD_NAME,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: JSON.stringify({
              value: '""',
              parser: 'logfmt',
            }),
            valueLabels: ['""'],
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_FIELDS,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: JSON.stringify({
              value: '""',
              parser: 'logfmt',
            }),
            valueLabels: ['""'],
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
  describe('metadata', () => {
    it('Returns an empty array when everything is empty', () => {
      const fieldsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [],
      });
      expect(getVisibleFilters('', [], fieldsVariable)).toEqual([]);
    });
    it('Returns all levels when there are no filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [],
      });
      expect(getVisibleFilters('', ['error', 'info'], labelsVariable)).toEqual(['error', 'info']);
    });
    it('Removes negatively filtered levels', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'info'], labelsVariable)).toEqual(['info']);
    });
    it('Returns the positive levels from the filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['info'], labelsVariable)).toEqual(['info']);
    });
    it('Filters the levels by the current filters', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'error',
          },
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: 'warn',
          },
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: 'info',
          },
        ],
      });

      expect(getVisibleFilters('detected_level', ['error', 'warn', 'info', 'debug'], labelsVariable)).toEqual(['info']);
    });
    it('Handles empty positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.Equal,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual([]);
    });
    it('Handles negative positive log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.NotEqual,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error', 'logs'], labelsVariable)).toEqual(['error', 'logs']);
    });
    it('Handles exclusion regex negative log level filter', () => {
      const labelsVariable = new AdHocFiltersVariable({
        name: VAR_METADATA,
        filters: [
          {
            key: 'detected_level',
            operator: FilterOp.RegexNotEqual,
            value: '""',
          },
        ],
      });
      expect(getVisibleFilters('detected_level', ['error'], labelsVariable)).toEqual(['error']);
    });
  });
});
