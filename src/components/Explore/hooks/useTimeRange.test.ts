import { renderHook, waitFor } from '@testing-library/react';

import { StoreContextWrapper } from '../Context/Context';

import { useTimeRange } from './useTimeRange';

jest.mock('@/components/Context/Context');

describe('useTimeRange', () => {
  test('Provides a data source instance', async () => {
    const { result } = renderHook(() => useTimeRange(), { wrapper: StoreContextWrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
