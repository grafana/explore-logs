import _ from 'lodash';

/**
 * Order doesn't matter, converts to sets, deep compare via lodash isEqual
 * @param arr1
 * @param arr2
 */

export const areArraysEqual = (arr1: any[] | undefined, arr2: any[] | undefined) => {
  // If one array is undefined, and the other is empty, they will cast to the same set.
  if (typeof arr1 !== typeof arr2) {
    return false;
  }
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  // Save us from running the isEqual check if the set sizes are different
  if (set1.size !== set2.size) {
    return false;
  }

  return _.isEqual(set1, set2);
};

export const areArraysStrictlyEqual = (arr1: any[] | undefined, arr2: any[] | undefined) => {
  // If one array is undefined, and the other is empty, they will cast to the same set.
  if (typeof arr1 !== typeof arr2) {
    return false;
  }
  return _.isEqual(arr1, arr2);
};
