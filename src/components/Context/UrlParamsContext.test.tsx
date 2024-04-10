import { act, renderHook, waitFor } from '@testing-library/react';

import { UrlParamsContextProvider, useUrlParamsContext } from './UrlParamsContext';

describe('QueryParamsContext', () => {
  test('Provides the context methods', async () => {
    const { result } = renderHook(() => useUrlParamsContext(), { wrapper: UrlParamsContextProvider });

    await waitFor(() => {
      expect(result.current.getUrlParameter).toBeDefined();
      expect(result.current.setUrlParameter).toBeDefined();
    });
  });

  test('Allows to get and change query parameters', async () => {
    const { result } = renderHook(() => useUrlParamsContext(), { wrapper: UrlParamsContextProvider });

    act(() => {
      result.current.setUrlParameter('key', 'value');
    });
    await waitFor(() => {
      expect(result.current.getUrlParameter('key')).toEqual('value');
    });
  });
});
