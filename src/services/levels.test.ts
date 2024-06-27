import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { getLabelsFromSeries, toggleLevelFromFilter } from './levels';
import { FieldType, toDataFrame } from '@grafana/data';

const ALL_LEVELS = ['logs', 'debug', 'info', 'warn', 'error', 'crit'];

describe('toggleLevelFromFilter', () => {
  describe('Visibility mode toggle selection', () => {
    it('adds the level', () => {
      expect(toggleLevelFromFilter('error', [], SeriesVisibilityChangeMode.ToggleSelection, ALL_LEVELS)).toEqual([
        'error',
      ]);
      expect(toggleLevelFromFilter('error', undefined, SeriesVisibilityChangeMode.ToggleSelection, ALL_LEVELS)).toEqual(
        ['error']
      );
    });
    it('adds the level if the filter was not empty', () => {
      expect(
        toggleLevelFromFilter('error', ['info', 'debug'], SeriesVisibilityChangeMode.ToggleSelection, ALL_LEVELS)
      ).toEqual(['error']);
    });
    it('removes the level if the filter contained only the same level', () => {
      expect(toggleLevelFromFilter('error', ['error'], SeriesVisibilityChangeMode.ToggleSelection, ALL_LEVELS)).toEqual(
        []
      );
    });
  });
  describe('Visibility mode append to selection', () => {
    it('appends the label to other levels', () => {
      expect(
        toggleLevelFromFilter('error', ['info'], SeriesVisibilityChangeMode.AppendToSelection, ALL_LEVELS)
      ).toEqual(['info', 'error']);
    });
    it('removes the label if already present', () => {
      expect(
        toggleLevelFromFilter('error', ['info', 'error'], SeriesVisibilityChangeMode.AppendToSelection, ALL_LEVELS)
      ).toEqual(['info']);
    });
    it('appends all levels except the provided level if the filter was previously empty', () => {
      const allButError = ALL_LEVELS.filter((level) => level !== 'error');
      expect(toggleLevelFromFilter('error', [], SeriesVisibilityChangeMode.AppendToSelection, ALL_LEVELS)).toEqual(
        allButError
      );
      expect(
        toggleLevelFromFilter('error', undefined, SeriesVisibilityChangeMode.AppendToSelection, ALL_LEVELS)
      ).toEqual(allButError);
    });
  });
});

describe('getLabelsFromSeries', () => {
  const series = [
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [1],
          labels: {
            detected_level: 'error',
          },
        },
      ],
    }),
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [1],
          labels: {
            detected_level: 'warn',
          },
        },
      ],
    }),
    toDataFrame({
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Value',
          type: FieldType.number,
          values: [1],
          labels: {},
        },
      ],
    }),
  ];
  it('returns the label value from time series', () => {
    expect(getLabelsFromSeries(series)).toEqual(['error', 'warn', 'logs']);
  });
});
