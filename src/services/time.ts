import { AbsoluteTimeRange, dateTime, isDateTime, RawTimeRange, TimeRange } from '@grafana/data';

export const MILLISECOND = 1;
export const SECOND = 1000 * MILLISECOND;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const getDefaultTimeRange = (): TimeRange => {
  const now = dateTime();

  return {
    from: dateTime(now).subtract(30, 'minutes'),
    to: now,
    raw: { from: 'now-30m', to: 'now' },
  };
};

export const getZoomedTimeRange = (range: TimeRange, factor: number): AbsoluteTimeRange => {
  const timespan = range.to.valueOf() - range.from.valueOf();
  const center = range.to.valueOf() - timespan / 2;
  // If the timepsan is 0, zooming out would do nothing, so we force a zoom out to 30s
  const newTimespan = timespan === 0 ? 30 * SECOND : timespan * factor;

  const to = center + newTimespan / 2;
  const from = center - newTimespan / 2;

  return { from, to };
};

export type URLRange = {
  from: string;
  to: string;
};

/**
 * Converts RawTimeRange to a string that is stored in the URL
 * - relative - stays as it is (e.g. "now")
 * - absolute - converted to ms
 */
export const toURLRange = (range: RawTimeRange): URLRange => {
  let from = range.from;
  if (isDateTime(from)) {
    from = from.valueOf().toString();
  }

  let to = range.to;
  if (isDateTime(to)) {
    to = to.valueOf().toString();
  }

  return {
    from,
    to,
  };
};

export const absoluteTimeRangeToTimeRange = (range: AbsoluteTimeRange): TimeRange => {
  return {
    from: dateTime(range.from),
    to: dateTime(range.to),
    raw: {
      from: dateTime(range.from),
      to: dateTime(range.to),
    },
  };
};
