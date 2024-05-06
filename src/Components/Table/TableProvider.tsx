import React from 'react';

import { TableWrap } from 'Components/Table/TableWrap';
import { DataFrame } from '@grafana/data';
import { QueryContextProvider } from 'Components/Table/Context/QueryContext';
import { parseLogsFrame } from '../../services/logsFrame';

interface TableProviderProps {
  dataFrame: DataFrame;
}

export const TableProvider = ({ dataFrame }: TableProviderProps) => {
  if (!dataFrame) {
    return null;
  }

  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  return (
    <QueryContextProvider logsFrame={logsFrame}>
      <TableWrap />
    </QueryContextProvider>
  );
};
