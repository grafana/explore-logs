import React, { createContext, ReactNode, useContext } from 'react';
import { AdHocVariableFilter } from '@grafana/data';
import { TablePanelProps } from '../../ServiceScene/LogsTableScene';

type ScenesTableContextType = TablePanelProps;

const ScenesTableContext = createContext<ScenesTableContextType>({
  filters: [],
  addFilter: (filter: AdHocVariableFilter) => {},
  timeRange: undefined,
  selectedLine: undefined,
});

export const ScenesTableContextProvider = ({
  children,
  filters,
  addFilter,
  selectedLine,
  timeRange,
}: {
  children: ReactNode;
} & ScenesTableContextType) => {
  return (
    <ScenesTableContext.Provider value={{ filters, addFilter, selectedLine, timeRange }}>
      {children}
    </ScenesTableContext.Provider>
  );
};

export const useScenesTableContext = () => {
  return useContext(ScenesTableContext);
};
