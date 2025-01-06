import React from 'react';

import { TableWrap } from 'Components/Table/TableWrap';
import { AdHocVariableFilter, DataFrame, TimeRange } from '@grafana/data';
import { QueryContextProvider } from 'Components/Table/Context/QueryContext';
import { parseLogsFrame } from '../../services/logsFrame';
import { SelectedTableRow } from './LogLineCellComponent';
import { LogLineState } from './Context/TableColumnsContext';

interface TableProviderProps {
  dataFrame: DataFrame;
  setUrlColumns: (columns: string[]) => void;
  urlColumns: string[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
  panelWrap: React.RefObject<HTMLDivElement | null>;
  clearSelectedLine: () => void;
  setUrlTableBodyState: (logLineState: LogLineState) => void;
  urlTableBodyState?: LogLineState;
}

export const TableProvider = ({
  dataFrame,
  setUrlColumns,
  urlColumns,
  addFilter,
  selectedLine,
  timeRange,
  panelWrap,
  clearSelectedLine,
  setUrlTableBodyState,
  urlTableBodyState,
}: TableProviderProps) => {
  if (!dataFrame) {
    return null;
  }

  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  return (
    <QueryContextProvider addFilter={addFilter} selectedLine={selectedLine} timeRange={timeRange} logsFrame={logsFrame}>
      <TableWrap
        urlTableBodyState={urlTableBodyState}
        setUrlColumns={setUrlColumns}
        setUrlTableBodyState={setUrlTableBodyState}
        urlColumns={urlColumns}
        panelWrap={panelWrap}
        clearSelectedLine={clearSelectedLine}
      />
    </QueryContextProvider>
  );
};
