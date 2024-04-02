import React, { ReactNode } from 'react';

import { DataSourceContextProvider } from './DataSourceContext';
import { LabelsContextProvider } from './LabelsContext';
import { QueryContextProvider } from './QueryContext';
import { TimeRangeContextProvider } from './TimeRangeContext';
import { UrlParamsContextProvider } from './UrlParamsContext';

type Props = {
  children: ReactNode[] | ReactNode;
};

export const StoreContextWrapper = ({ children }: Props) => {
  return (
    <UrlParamsContextProvider>
      <DataSourceContextProvider>
        <TimeRangeContextProvider>
          <QueryContextProvider>
            <LabelsContextProvider>{children}</LabelsContextProvider>
          </QueryContextProvider>
        </TimeRangeContextProvider>
      </DataSourceContextProvider>
    </UrlParamsContextProvider>
  );
};
