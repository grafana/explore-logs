import { getMockFrames } from '../mocks/DataFrameMock';
import { getLabelCardinalityMap } from './fields';
describe('getCardinalityMapFromFrame', () => {
  test('calculates cardinality map from dataframe', async () => {
    const frame = getMockFrames();
    const labels = frame.logFrameA.fields.find((f) => f.name === 'labels')?.values;
    const map = getLabelCardinalityMap(labels);
    expect(map.get('label')?.valueSet.size).toBe(2);
    expect(map.get('commonLabel')?.valueSet.size).toBe(1);
    expect(map.get('otherLabel')?.valueSet.size).toBe(1);
  });
});
