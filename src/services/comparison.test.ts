import { areArraysEqual, areArraysStrictlyEqual } from './comparison';

describe('areArraysEqual', () => {
  it('should return false when one array is undefined and the other is empty', () => {
    expect(areArraysEqual([], undefined)).toBe(false);
  });
  it('should return false when one array contains empty object', () => {
    expect(areArraysEqual([''], [{}])).toBe(false);
  });
  it('should return true when both arrays are empty', () => {
    expect(areArraysEqual([], [])).toBe(true);
  });
  it('should return true when both arrays are undefined', () => {
    expect(areArraysEqual(undefined, undefined)).toBe(true);
  });
  it('should return true when arrays are same, but in different order', () => {
    expect(areArraysEqual(['a', 'b', 'c'], ['b', 'c', 'a'])).toBe(true);
  });
  it('should return true when nested objects have different orders', () => {
    expect(
      areArraysEqual(
        [
          { d: 'd', c: 'c' },
          { b: 'b', a: 'a' },
        ],
        [
          { a: 'a', b: 'b' },
          { c: 'c', d: 'd' },
        ]
      )
    ).toBe(true);
  });

  it('should return true when nested objects are same', () => {
    expect(
      areArraysEqual(
        [
          {
            a: { b: 'b', a: 'a' },
          },
          { b: 'b', a: 'a' },
        ],
        [
          {
            a: { a: 'a', b: 'b' },
          },
          { a: 'a', b: 'b' },
        ]
      )
    ).toBe(true);
  });

  it('should return false when nested objects are different', () => {
    expect(
      areArraysEqual(
        [
          {
            a: { b: 'b', a: 'a' },
          },
          {
            b: 'b',
            a: 'a',
          },
        ],
        [
          {
            a: {
              c: 'b',
              a: 'a',
            },
          },
          {
            c: 'c',
            d: 'd',
          },
        ]
      )
    ).toBe(false);
  });

  it('should return false when nested objects contain subsets', () => {
    expect(
      areArraysEqual(
        [
          {
            a: {
              b: 'b',
              a: 'a',
            },
          },
          {
            b: 'b',
            a: 'a',
          },
        ],
        [
          {
            a: {
              c: 'b',
              a: 'a',
              e: 'e',
            },
          },
          {
            c: 'c',
            d: 'd',
          },
        ]
      )
    ).toBe(false);
  });
});
describe('areArraysStrictlyEqual', () => {
  it('should return false when one array is undefined and the other is empty', () => {
    expect(areArraysStrictlyEqual([], undefined)).toBe(false);
  });
  it('should return false when one array contains empty object', () => {
    expect(areArraysStrictlyEqual([''], [{}])).toBe(false);
  });
  it('should return true when both arrays are empty', () => {
    expect(areArraysStrictlyEqual([], [])).toBe(true);
  });
  it('should return true when both arrays are undefined', () => {
    expect(areArraysStrictlyEqual(undefined, undefined)).toBe(true);
  });
  it('should return false when arrays are same, but in different order', () => {
    expect(areArraysStrictlyEqual(['a', 'b', 'c'], ['b', 'c', 'a'])).toBe(false);
  });
  it('should return false when nested objects have different orders', () => {
    expect(
      areArraysStrictlyEqual(
        [
          { d: 'd', c: 'c' },
          { b: 'b', a: 'a' },
        ],
        [
          { a: 'a', b: 'b' },
          { c: 'c', d: 'd' },
        ]
      )
    ).toBe(false);
  });

  it('should return true when nested objects are same', () => {
    expect(
      areArraysEqual(
        [
          {
            a: { b: 'b', a: 'a' },
          },
          { b: 'b', a: 'a' },
        ],
        [
          {
            a: { a: 'a', b: 'b' },
          },
          { a: 'a', b: 'b' },
        ]
      )
    ).toBe(true);
  });

  it('should return false when nested objects are different', () => {
    expect(
      areArraysEqual(
        [
          {
            a: { b: 'b', a: 'a' },
          },
          {
            b: 'b',
            a: 'a',
          },
        ],
        [
          {
            a: {
              c: 'b',
              a: 'a',
            },
          },
          {
            c: 'c',
            d: 'd',
          },
        ]
      )
    ).toBe(false);
  });

  it('should return false when nested objects contain subsets', () => {
    expect(
      areArraysEqual(
        [
          {
            a: {
              b: 'b',
              a: 'a',
            },
          },
          {
            b: 'b',
            a: 'a',
          },
        ],
        [
          {
            a: {
              c: 'b',
              a: 'a',
              e: 'e',
            },
          },
          {
            c: 'c',
            d: 'd',
          },
        ]
      )
    ).toBe(false);
  });
});
