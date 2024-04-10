import { renderHook, waitFor } from '@testing-library/react';

import { StoreContextWrapper } from '@/components/Context/Context';

import { useDataSource } from './useDataSource';

jest.mock('@/components/Context/Context');

describe('useDataSource', () => {
  test('Provides the data source instance', async () => {
    const { result } = renderHook(() => useDataSource(), { wrapper: StoreContextWrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
