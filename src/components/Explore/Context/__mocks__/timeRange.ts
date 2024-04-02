import { dateTime, TimeRange } from '@grafana/data';

const now = dateTime();
export const timeRangeMock: TimeRange = {
  from: dateTime(now).subtract(3, 'hours'),
  to: now,
  raw: {
    from: 'now-3h',
    to: 'now',
  },
};
