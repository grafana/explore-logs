import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { ALL_LEVELS, toggleLevelFromFilter } from './levels';

describe('toggleLevelFromFilter', () => {
  describe('Visibility mode toggle selection', () => {
    it('adds the level', () => {
      expect(toggleLevelFromFilter('error', [], SeriesVisibilityChangeMode.ToggleSelection)).toEqual(['error']);
      expect(toggleLevelFromFilter('error', undefined, SeriesVisibilityChangeMode.ToggleSelection)).toEqual(['error']);
    });
    it('adds the level if the filter was not empty', () => {
      expect(toggleLevelFromFilter('error', ['info', 'debug'], SeriesVisibilityChangeMode.ToggleSelection)).toEqual([
        'error',
      ]);
    });
    it('removes the level if the filter contained only the same level', () => {
      expect(toggleLevelFromFilter('error', ['error'], SeriesVisibilityChangeMode.ToggleSelection)).toEqual([]);
    });
  });
  describe('Visibility mode append to selection', () => {
    it('appends the label to other levels', () => {
      expect(toggleLevelFromFilter('error', ['info'], SeriesVisibilityChangeMode.AppendToSelection)).toEqual([
        'info',
        'error',
      ]);
    });
    it('removes the label if already present', () => {
      expect(toggleLevelFromFilter('error', ['info', 'error'], SeriesVisibilityChangeMode.AppendToSelection)).toEqual([
        'info',
      ]);
    });
    it('appends all levels except the provided level if the filter was previously empty', () => {
      const allButError = ALL_LEVELS.filter((level) => level !== 'error');
      expect(toggleLevelFromFilter('error', [], SeriesVisibilityChangeMode.AppendToSelection)).toEqual(allButError);
      expect(toggleLevelFromFilter('error', undefined, SeriesVisibilityChangeMode.AppendToSelection)).toEqual(
        allButError
      );
    });
  });
});
