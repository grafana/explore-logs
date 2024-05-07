import { createContext, useContext } from 'react';
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

// @todo remove and clean up
export const useScenesTableContext = () => {
  return useContext(ScenesTableContext);
};
