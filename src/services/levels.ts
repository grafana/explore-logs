import { DataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { LEVEL_VARIABLE_VALUE, VAR_LEVELS } from './variables';
import { SceneObject } from '@grafana/scenes';
import { addToFilters, replaceFilter } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getLevelsVariable } from './variableGetters';
import { isOperatorExclusive, isOperatorInclusive } from './operators';

/**
 * Given a set of `visibleLevels` in a panel, it returns a list of the new visible levels
 * after applying the visibility change in `mode`.
 */
export function toggleLevelVisibility(
  level: string,
  visibleLevels: string[] | undefined,
  mode: SeriesVisibilityChangeMode,
  allLevels: string[]
) {
  if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
    const levels = visibleLevels ?? [];
    if (levels.length === 1 && levels.includes(level)) {
      return [];
    }
    return [level];
  }
  /**
   * When the behavior is `AppendToSelection` and the filter is empty, we initialize it
   * with all levels because the user is excluding this level in their action.
   */
  let levels = !visibleLevels?.length ? allLevels : visibleLevels;
  if (levels.includes(level)) {
    return levels.filter((existingLevel) => existingLevel !== level);
  }

  return [...levels, level];
}

export function getLabelsFromSeries(series: DataFrame[]) {
  return series.map((dataFrame) => getLabelValueFromDataFrame(dataFrame) ?? 'logs');
}

export function getLabelValueFromDataFrame(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return null;
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return null;
  }

  return labels[keys[0]];
}

/*
 * From the current state of the levels filter, return the level names that
 * the user wants to see.
 */
export function getVisibleLevels(allLevels: string[], sceneRef: SceneObject) {
  const levelsFilter = getLevelsVariable(sceneRef);
  const wantedLevels = levelsFilter.state.filters
    .filter((filter) => isOperatorInclusive(filter.operator))
    .map((filter) => filter.value.split('|').map(normalizeLevelName))
    .join('|');
  const unwantedLevels = levelsFilter.state.filters
    .filter((filter) => isOperatorExclusive(filter.operator))
    .map((filter) => filter.value.split('|').map(normalizeLevelName))
    .join('|');
  return allLevels.filter((level) => {
    if (unwantedLevels.includes(level)) {
      return false;
    }
    return wantedLevels.length === 0 || wantedLevels.includes(level);
  });
}

function normalizeLevelName(level: string) {
  if (level === '""') {
    return 'logs';
  }
  return level;
}

/**
 * Toggle a level from the filter state.
 * If the filter is empty, it's added.
 * If the filter exists but it's different, it's replaced.
 * If the filter exists, it's removed.
 */
export function toggleLevelFromFilter(level: string, sceneRef: SceneObject) {
  const levelFilter = getLevelsVariable(sceneRef);
  const empty = levelFilter.state.filters.length === 0;
  const filterExists = levelFilter.state.filters.find(
    (filter) => filter.value.split('|').includes(level) && isOperatorInclusive(filter.operator)
  );

  if (level === 'logs') {
    level = '""';
  }

  let action;
  if (empty || !filterExists) {
    replaceFilter(LEVEL_VARIABLE_VALUE, level, 'include', sceneRef, VAR_LEVELS);
    action = 'add';
  } else {
    addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', sceneRef, VAR_LEVELS);
    action = 'remove';
  }

  return action;
}
