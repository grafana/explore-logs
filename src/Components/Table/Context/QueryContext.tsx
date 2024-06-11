import React, { createContext, ReactNode, useContext } from 'react';
import { LogsFrame } from '../../../services/logsFrame';
import { AdHocVariableFilter, TimeRange } from '@grafana/data';
import { SelectedTableRow } from '../LogLineCellComponent';

export type Label = { name: string; values: string[]; indexed: boolean };

export type QueryContextType = {
  logsFrame: LogsFrame | null;
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
};

export const initialState = {
  logsFrame: null,
  filters: [],
  addFilter: (filter: AdHocVariableFilter) => {},
  timeRange: undefined,
  selectedLine: undefined,
};

export const QueryContext = createContext<QueryContextType>(initialState);

export const QueryContextProvider = ({
  children,
  logsFrame,
  addFilter,
  filters,
  selectedLine,
  timeRange,
}: {
  children: ReactNode;
  logsFrame: LogsFrame;
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}) => {
  return (
    <QueryContext.Provider
      value={{
        logsFrame,
        addFilter,
        selectedLine,
        timeRange,
        filters,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

export const useQueryContext = () => {
  return useContext(QueryContext);
};
