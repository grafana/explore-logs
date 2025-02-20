import { AdHocFiltersVariable } from '@grafana/scenes';
import { VAR_LABELS } from './variables';
import { FilterOp } from './filterTypes';
import { getVisibleFilters } from './labels';

describe('getVisibleFilters', () => {
  // @todo fields, metadata
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
});
