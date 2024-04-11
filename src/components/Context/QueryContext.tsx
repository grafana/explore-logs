import React, { createContext, ReactNode, useContext } from 'react';
import { LogsFrame } from '@/services/logsFrame';

export type Label = { name: string; values: string[]; indexed: boolean };

export type QueryContextType = {
  logsFrame: LogsFrame | null;
};

export const initialState = {
  logsFrame: null,
};

export const QueryContext = createContext<QueryContextType>(initialState);

export const QueryContextProvider = ({ children, logsFrame }: { children: ReactNode; logsFrame: LogsFrame }) => {
  return (
    <QueryContext.Provider
      value={{
        logsFrame,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

export const useQueryContext = () => {
  return useContext(QueryContext);
};
