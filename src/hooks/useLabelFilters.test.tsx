import React, { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';

import { TestContext } from '@/components/Context/__mocks__/TestContext';
import { ContextLabel } from '@/components/Context/LabelsContext';
import { FilterOp, FilterType, useQueryContext } from '@/components/Context/QueryContext';

import { useLabelFilters } from './useLabels';

jest.mock('@/components/Context/QueryContext', () => ({
  ...jest.requireActual('@/components/Context/QueryContext'),
  useQueryContext: jest.fn().mockReturnValue({ addLabelFilter: jest.fn() }),
}));

function ContextWrapper({ children }: { children: ReactNode }) {
  const labels: ContextLabel[] = [
    {
      name: 'app',
      values: [{ value: 'loki' }],
    },
  ];
  return <TestContext labelsContext={{ labels }}>{children}</TestContext>;
}

describe('useLabelFilters', () => {
  test('Allows to add indexed label filters', async () => {
    const { addLabelFilter } = useQueryContext();
    const { result } = renderHook(() => useLabelFilters(), { wrapper: ContextWrapper });

    act(() => {
      result.current.addLabelFilter('app', 'loki', FilterOp.Equal);
    });

    // app=loki exists within LabelsContext, so it's added as an indexed label.
    await waitFor(() => {
      expect(addLabelFilter).toHaveBeenCalledWith('app', 'loki', FilterType.IndexedLabel, FilterOp.Equal);
    });
  });

  test('Allows to add non-indexed label filters', async () => {
    const { addLabelFilter } = useQueryContext();
    const { result } = renderHook(() => useLabelFilters(), { wrapper: ContextWrapper });

    act(() => {
      result.current.addLabelFilter('anythingElse', 'anyOtherValue', FilterOp.NotEqual);
    });

    await waitFor(() => {
      expect(addLabelFilter).toHaveBeenCalledWith(
        'anythingElse',
        'anyOtherValue',
        FilterType.NonIndexedLabel,
        FilterOp.NotEqual
      );
    });
  });
});
