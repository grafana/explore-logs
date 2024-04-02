import { useCallback } from 'react';

import { useUrlParamsContext } from '../Context/UrlParamsContext';

/**
 * Shorthand version of the low level hook `useUrlParamsContext()`.
 * Returns a tuple with the current value of the query parameter and a function to set it.
 *
 * @param key - The key of the query parameter.
 */
export function useUrlParameter<T>(key: string): [T | null, (value: T) => void] {
  const { getUrlParameter, setUrlParameter } = useUrlParamsContext();
  const setParamCallback = useCallback(<T>(value: T) => setUrlParameter(key, value), [key, setUrlParameter]);
  return [getUrlParameter<T>(key), setParamCallback];
}
