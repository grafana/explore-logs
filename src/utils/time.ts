import { isDateTime, RawTimeRange } from '@grafana/data';
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

export type URLRange = {
  from: string;
  to: string;
};