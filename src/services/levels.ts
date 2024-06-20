import { SeriesVisibilityChangeMode } from '@grafana/ui';

export const ALL_LEVELS = ['logs', 'debug', 'info', 'warn', 'error', 'crit'];

export function toggleLevelFromFilter(
  level: string,
  serviceLevels: string[] | undefined,
  mode: SeriesVisibilityChangeMode
) {
  if (mode === SeriesVisibilityChangeMode.ToggleSelection) {
    const levels = serviceLevels || [];
    if (levels.length === 1 && levels.includes(level)) {
      return levels.filter((existingLevel) => existingLevel !== level);
    }
    return [level];
  }
  /**
   * When the behavior is `AppendToSelection` and the filter is empty, we initialize it
   * with all levels because the user is excluding this level in their action.
   */
  let levels = !serviceLevels?.length ? ALL_LEVELS : serviceLevels;
  if (levels.includes(level)) {
    return levels.filter((existingLevel) => existingLevel !== level);
  }

  return [...levels, level];
}
