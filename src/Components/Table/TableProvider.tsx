import React from 'react';

import { TableWrap } from 'Components/Table/TableWrap';
import { AdHocVariableFilter, DataFrame, TimeRange } from '@grafana/data';
import { QueryContextProvider } from 'Components/Table/Context/QueryContext';
import { parseLogsFrame } from '../../services/logsFrame';
import { SelectedTableRow } from './LogLineCellComponent';

interface TableProviderProps {
  dataFrame: DataFrame;
  setUrlColumns: (columns: string[]) => void;
  urlColumns: string[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
  panelWrap: React.RefObject<HTMLDivElement>;
  clearSelectedLine: () => void;
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
        setUrlColumns={setUrlColumns}
        urlColumns={urlColumns}
        panelWrap={panelWrap}
        clearSelectedLine={clearSelectedLine}
      />
    </QueryContextProvider>
  );
};
