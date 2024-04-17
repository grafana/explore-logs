import React, { createContext, ReactNode, useContext } from 'react';
import { AdHocVariableFilter } from '@grafana/data';
import { TablePanelProps } from '@/components/Explore/LogsByService/Tabs/LogsListScene';

type ScenesTableContextType = TablePanelProps;

const ScenesTableContext = createContext<ScenesTableContextType>({
  filters: [],
  addFilter: (filter: AdHocVariableFilter) => {},
  // setSelectedColumns: (cols: string[]) => {},
  timeRange: undefined,
  // selectedColumns: [],
  selectedLine: undefined,
});

export const ScenesTableContextProvider = ({
  children,
  filters,
  addFilter,
  // selectedColumns,
  // setSelectedColumns,
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
