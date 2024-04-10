import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

import { dateTime, rangeUtil, TimeRange } from '@grafana/data';

import { useUrlParameter } from '@/hooks/useUrlParameter';
import { UrlParameterType } from '@/services/routing';
import { getDefaultTimeRange } from '@/services/time';

type TimeRangeContextType = {
  timeRange: TimeRange;
  setTimeRange(newTimeRange: TimeRange): void;
};

const TimeRangeContext = createContext<TimeRangeContextType>({
  timeRange: getDefaultTimeRange(),
  setTimeRange: (newTimeRange: TimeRange) => {},
});

export const TimeRangeContextProvider = ({ children }: { children: ReactNode }) => {
  const [timeRangeParam, setTimeRangeParam] = useUrlParameter<TimeRange>(UrlParameterType.TimeRange);
  let defaultRange = getDefaultTimeRange();
  if (timeRangeParam) {
    // We will always store the complete `TimeRange` object in the URL, so we
    // have the relative (e.g. `from: 'now-1h'`) and the absolute (e.g. `from:
    // '2021-01-01T00:00:00Z'`) time in the URL. If the page is refreshed, we
    // will use the relative time range and for everything else, we will use the
    // absolute.
    const isRefreshed = window.performance
      .getEntriesByType('navigation')
      .map((nav) => nav.type)
      .includes('reload');
    if (isRefreshed) {
      defaultRange = rangeUtil.convertRawToRange(timeRangeParam.raw);
    } else {
      defaultRange = rangeUtil.convertRawToRange({
        from: dateTime(timeRangeParam.from),
        to: dateTime(timeRangeParam.to),
      });
    }
  }
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultRange);

  const handleSetTimeRange = useCallback(
    (newTimeRange: TimeRange) => {
      setTimeRange(newTimeRange);
      setTimeRangeParam(newTimeRange);
    },
    [setTimeRangeParam]
  );

  return (
    <TimeRangeContext.Provider value={{ timeRange, setTimeRange: handleSetTimeRange }}>
      {children}
    </TimeRangeContext.Provider>
  );
};

export const useTimeRangeContext = () => {
  return useContext(TimeRangeContext);
};
