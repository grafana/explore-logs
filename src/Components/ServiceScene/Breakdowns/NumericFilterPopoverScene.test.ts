import { extractValueFromString } from './NumericFilterPopoverScene';

describe('extractValueFromString', () => {
  it('should parse bytes', () => {
    expect(extractValueFromString('10KB', 'bytes')).toEqual({ unit: 'KB', value: 10 });
    expect(extractValueFromString('100B', 'bytes')).toEqual({ unit: 'B', value: 100 });
    expect(extractValueFromString('100MB', 'bytes')).toEqual({ unit: 'MB', value: 100 });
    expect(extractValueFromString('1e9GB', 'bytes')).toEqual({ unit: 'GB', value: 1000000000 });
    expect(extractValueFromString('0.1TB', 'bytes')).toEqual({ unit: 'TB', value: 0.1 });
  });

  it('should parse duration', () => {
    expect(extractValueFromString('10s', 'duration')).toEqual({ unit: 's', value: 10 });
    expect(extractValueFromString('100h', 'duration')).toEqual({ unit: 'h', value: 100 });
    expect(extractValueFromString('0.01h', 'duration')).toEqual({ unit: 'h', value: 0.01 });
    expect(extractValueFromString('1e9m', 'duration')).toEqual({ unit: 'm', value: 1000000000 });
    expect(extractValueFromString('99µs', 'duration')).toEqual({ unit: 'µs', value: 99 });
  });
});
