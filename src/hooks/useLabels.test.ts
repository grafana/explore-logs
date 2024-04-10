import { renderHook, waitFor } from '@testing-library/react';

import { StoreContextWrapper } from '@/components/Context/Context';

import { useLabels } from './useLabels';

jest.mock('@/components/Context/Context');

describe('useLabels', () => {
  test('Provides the labels instance', async () => {
    const { result } = renderHook(() => useLabels(), { wrapper: StoreContextWrapper });

    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
  });
});
