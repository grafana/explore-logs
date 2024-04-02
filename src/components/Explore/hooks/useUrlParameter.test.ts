import { act, renderHook, waitFor } from '@testing-library/react';

import { UrlParamsContextProvider } from '../Context/UrlParamsContext';

import { useUrlParameter } from './useUrlParameter';

describe('useUrlParameter', () => {
  test('provides the param value', async () => {
    const { result } = renderHook(() => useUrlParameter<string>('foo'), { wrapper: UrlParamsContextProvider });

    act(() => {
      result.current[1]('bar');
    });

    await waitFor(() => {
      expect(result.current[0]).toBe('bar');
    });
  });
});
