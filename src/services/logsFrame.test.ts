import { FieldType } from '@grafana/data';
import { getSeriesVisibleRange } from './logsFrame';

describe('logsFrame', () => {
  describe('getSeriesVisibleRange', () => {
    it('should not sort the timeField in place', () => {
      const timeField = {
        values: [2, 1],
        type: FieldType.time,
        length: 2,
        name: 'time',
        config: {},
      };
      const series = [{ fields: [timeField], length: 2 }];
      getSeriesVisibleRange(series);
      expect(timeField.values).toEqual([2, 1]);
    });

    it('should return the correct range when the values are sorted', () => {
      const timeField = {
        values: [1, 2],
        type: FieldType.time,
        length: 2,
        name: 'time',
        config: {},
      };
      const series = [{ fields: [timeField], length: 2 }];
      expect(getSeriesVisibleRange(series)).toEqual({ start: 1, end: 2 });
    });

    it('should return the correct range when the values are not sorted', () => {
      const timeField = {
        values: [2, 1],
        type: FieldType.time,
        length: 2,
        name: 'time',
        config: {},
      };
      const series = [{ fields: [timeField], length: 2 }];
      expect(getSeriesVisibleRange(series)).toEqual({ start: 1, end: 2 });
    });
  });
});
