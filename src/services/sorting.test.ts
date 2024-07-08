import { toDataFrame, FieldType, ReducerID } from '@grafana/data';
import { sortSeries } from './sorting';

const frameA = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [0, 1, 0],
    },
  ],
});
const frameB = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [1, 1, 1],
    },
  ],
});
const frameC = toDataFrame({
  fields: [
    { name: 'Time', type: FieldType.time, values: [0] },
    {
      name: 'Value',
      type: FieldType.number,
      values: [100, 9999, 100],
    },
  ],
});

describe('sortSeries', () => {
  test('Sorts series by standard deviation, descending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameC, frameA, frameB];

    const result = sortSeries(series, ReducerID.stdDev, 'desc');
    expect(result).toEqual(sortedSeries);
  });
  test('Sorts series by standard deviation, ascending', () => {
    const series = [frameA, frameB, frameC];
    const sortedSeries = [frameB, frameA, frameC];

    const result = sortSeries(series, ReducerID.stdDev, 'asc');
    expect(result).toEqual(sortedSeries);
  });
});
