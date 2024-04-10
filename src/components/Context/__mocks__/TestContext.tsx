import React, { ReactNode } from 'react';

import { LokiDatasource } from '@/services/lokiTypes';

import { DataSourceContext, DataSourceContextType, initialState as dsInitialState } from '../DataSourceContext';
import { initialState as labelsInitialState, LabelsContext, LabelsContextType } from '../LabelsContext';
import { initialState as queryInitialState, QueryContext, QueryContextType } from '../QueryContext';
import { TimeRangeContextProvider } from '../TimeRangeContext';

import { LokiDatasourceMock, mockInstanceSettings } from './LokiDataSource';

type Props = {
  children: ReactNode[] | ReactNode;
  dataSourceContext?: Partial<DataSourceContextType>;
  queryContext?: Partial<QueryContextType>;
  labelsContext?: Partial<LabelsContextType>;
};

export const TestContext = ({ children, dataSourceContext, queryContext, labelsContext }: Props) => {
  return (
    <DataSourceContext.Provider value={getDataSourceContextValue(dataSourceContext)}>
      <TimeRangeContextProvider>
        <QueryContext.Provider value={getQueryContextValue(queryContext)}>
          <LabelsContext.Provider value={getLabelsContextValue(labelsContext)}>{children}</LabelsContext.Provider>
        </QueryContext.Provider>
      </TimeRangeContextProvider>
    </DataSourceContext.Provider>
  );
};

function getDataSourceContextValue(overrides?: Partial<DataSourceContextType>) {
  const dataSource = new LokiDatasourceMock(mockInstanceSettings);
  return {
    ...dsInitialState,
    dataSource: dataSource as unknown as LokiDatasource,
    ...overrides,
  };
}

function getQueryContextValue(overrides?: Partial<QueryContextType>) {
  return {
    ...queryInitialState,
    ...overrides,
  };
}

function getLabelsContextValue(overrides?: Partial<LabelsContextType>) {
  return {
    ...labelsInitialState,
    ...overrides,
  };
}
