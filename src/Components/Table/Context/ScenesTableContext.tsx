import React, { createContext, ReactNode, useContext } from 'react';
import { AdHocVariableFilter } from '@grafana/data';
import { TablePanelProps } from '../../ServiceScene/LogsListScene';

type ScenesTableContextType = TablePanelProps;

const ScenesTableContext = createContext<ScenesTableContextType>({
  filters: [],
  addFilter: (filter: AdHocVariableFilter) => {},
  timeRange: undefined,
  selectedLine: undefined,
  urlColumns: [],
  setUrlColumns: (columns) => {},
});

export const ScenesTableContextProvider = ({
  children,
  filters,
  addFilter,
  selectedLine,
  timeRange,
  setUrlColumns,
}: {
  children: ReactNode;
} & ScenesTableContextType) => {
  return (
    <ScenesTableContext.Provider value={{ filters, addFilter, selectedLine, timeRange, setUrlColumns }}>
      {children}
    </ScenesTableContext.Provider>
  );
};

export const useScenesTableContext = () => {
  return useContext(ScenesTableContext);
};
