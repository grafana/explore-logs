import _ from 'lodash';

/**
 * Order doesn't matter, converts to sets, deep compare via lodash isEqual
 * @param arr1
 * @param arr2
 */

export const areArraysEqual = (arr1: any[] | undefined, arr2: any[] | undefined) => {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  if (set1.size !== set2.size) {
    return false;
  }
  return _.isEqual(set1, set2);
};
