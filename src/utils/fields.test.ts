import { getMockFrames } from '../mocks/DataFrameMock';
import { getCardinalityMapFromFrame } from './fields';

describe('getCardinalityMapFromFrame', () => {
  test('calculates cardinality map from dataframe', async () => {
    const frame = getMockFrames();
    const map = getCardinalityMapFromFrame(frame.logFrameA);
    expect(map.get('label')?.valueSet.size).toBe(2);
    expect(map.get('commonLabel')?.valueSet.size).toBe(1);
    expect(map.get('otherLabel')?.valueSet.size).toBe(1);
  });
});
