import { DataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';

export function toggleLevelFromFilter(
  level: string,
  serviceLevels: string[] | undefined,
  mode: SeriesVisibilityChangeMode,
  allLevels: string[]
) {
  if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
    const levels = serviceLevels ?? [];
    if (levels.length === 1 && levels.includes(level)) {
      return levels.filter((existingLevel) => existingLevel !== level);
    }
    return [level];
  }
  /**
   * When the behavior is `AppendToSelection` and the filter is empty, we initialize it
   * with all levels because the user is excluding this level in their action.
   */
  let levels = !serviceLevels?.length ? allLevels : serviceLevels;
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

export function getLabelNameFromDataFrame(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return null;
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return null;
  }

  return keys[0];
}
