import { act, renderHook, waitFor } from '@testing-library/react';

import { TimeRange, toUtc } from '@grafana/data';

import { TimeRangeContextProvider, useTimeRangeContext } from './TimeRangeContext';

describe('TimeRangeContext', () => {
  test('Provides the time range context', async () => {
    const { result } = renderHook(() => useTimeRangeContext(), { wrapper: TimeRangeContextProvider });

    await waitFor(() => {
      expect(result.current.timeRange).toBeDefined();
      expect(result.current.setTimeRange).toBeDefined();
    });
  });

  test('Allows to change the current range', async () => {
    const { result } = renderHook(() => useTimeRangeContext(), { wrapper: TimeRangeContextProvider });

    const newRange: TimeRange = {
      from: toUtc(0),
      to: toUtc(1),
      raw: {
        from: toUtc(0),
        to: toUtc(1),
      },
    };
    act(() => {
      result.current.setTimeRange(newRange);
    });
    await waitFor(() => {
      expect(result.current.timeRange).toEqual(newRange);
    });
  });
});
