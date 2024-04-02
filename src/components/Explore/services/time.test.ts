import { toUtc } from '@grafana/data';

import { getDefaultTimeRange, getZoomedTimeRange, toURLRange } from './time';

describe('getDefaultTimeRange', () => {
  test('returns the default time range for the app', () => {
    const timeRange = getDefaultTimeRange();
    expect(timeRange).toBeDefined();
    expect(timeRange.raw.from).toEqual('now-30m');
    expect(timeRange.raw.to).toEqual('now');
  });
});

describe('getZoomedTimeRange', () => {
  test('it should return a zoomed out range', () => {
    const range = {
      from: toUtc('2019-01-01 10:00:00'),
      to: toUtc('2019-01-01 16:00:00'),
      raw: {
        from: 'now-6h',
        to: 'now',
      },
    };

    const result = getZoomedTimeRange(range, 2);

    expect(result).toEqual({
      from: toUtc('2019-01-01 07:00:00').valueOf(),
      to: toUtc('2019-01-01 19:00:00').valueOf(),
    });
  });
  describe('when called with a timespan of 0', () => {
    test('it should return a timespan of 30s', () => {
      const range = {
        from: toUtc('2019-01-01 10:00:00'),
        to: toUtc('2019-01-01 10:00:00'),
        raw: {
          from: 'now',
          to: 'now',
        },
      };

      const result = getZoomedTimeRange(range, 2);

      expect(result).toEqual({
        from: toUtc('2019-01-01 09:59:45').valueOf(),
        to: toUtc('2019-01-01 10:00:15').valueOf(),
      });
    });
  });
});

describe('toURLRange', () => {
  test('returns the same range when is a string', () => {
    const range = { from: 'now-30m', to: 'now' };
    expect(toURLRange(range)).toEqual(range);
  });

  test('returns the stringified value', () => {
    const range = {
      from: toUtc('2019-01-01 09:59:45'),
      to: toUtc('2019-01-01 10:00:15'),
    };
    expect(toURLRange(range)).toEqual({
      from: range.from.valueOf().toString(),
      to: range.to.valueOf().toString(),
    });
  });
});
