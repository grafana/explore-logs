import React, { createContext, ReactNode, useContext } from 'react';
import { LokiDatasource } from '@/services/lokiTypes';
import { AdHocVariableFilter } from '@grafana/data';

type ScenesTableContextType = {
  dataSource: LokiDatasource | undefined;
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
};

const ScenesTableContext = createContext<ScenesTableContextType>({
  dataSource: undefined,
  filters: [],
  addFilter: (filter: AdHocVariableFilter) => {},
});

export const ScenesTableContextProvider = ({
  children,
  dataSource,
  filters,
  addFilter,
}: {
  children: ReactNode;
  dataSource: LokiDatasource | undefined;
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
}) => {
  return (
    <ScenesTableContext.Provider value={{ dataSource, filters, addFilter }}>{children}</ScenesTableContext.Provider>
  );
};

export const useScenesTableContext = () => {
  return useContext(ScenesTableContext);
};
