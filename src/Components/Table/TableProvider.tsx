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
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
  panelWrap: React.RefObject<HTMLDivElement>;
}

export const TableProvider = ({
  dataFrame,
  setUrlColumns,
  urlColumns,
  filters,
  addFilter,
  selectedLine,
  timeRange,
  panelWrap,
}: TableProviderProps) => {
  if (!dataFrame) {
    return null;
  }

  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  return (
    <QueryContextProvider
      filters={filters}
      addFilter={addFilter}
      selectedLine={selectedLine}
      timeRange={timeRange}
      logsFrame={logsFrame}
    >
      <TableWrap setUrlColumns={setUrlColumns} urlColumns={urlColumns} panelWrap={panelWrap} />
    </QueryContextProvider>
  );
};
