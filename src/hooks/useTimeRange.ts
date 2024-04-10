import { useTimeRangeContext } from '@/components/Context/TimeRangeContext';

/**
 * Shorthand version of the low level hook useTimeRangeContext().
 * @returns TimeRange
 */
export function useTimeRange() {
  const { timeRange } = useTimeRangeContext();
  return timeRange;
}
