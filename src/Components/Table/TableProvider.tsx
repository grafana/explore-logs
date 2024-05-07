import React from 'react';

import { TableWrap } from 'Components/Table/TableWrap';
import { DataFrame } from '@grafana/data';
import { QueryContextProvider } from 'Components/Table/Context/QueryContext';
import { parseLogsFrame } from '../../services/logsFrame';

interface TableProviderProps {
  dataFrame: DataFrame;
  setUrlColumns: (columns: string[]) => void;
  urlColumns: string[];
}

export const TableProvider = ({ dataFrame, setUrlColumns, urlColumns }: TableProviderProps) => {
  if (!dataFrame) {
    return null;
  }

  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  console.log('TableProvider', urlColumns);

  return (
    <QueryContextProvider logsFrame={logsFrame}>
      <TableWrap setUrlColumns={setUrlColumns} urlColumns={urlColumns} />
    </QueryContextProvider>
  );
};
