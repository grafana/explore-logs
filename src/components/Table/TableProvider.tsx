import React from 'react';

import { TableWrap } from '@/components/Table/TableWrap';
import { parseLogsFrame } from '@/services/logsFrame';
import { DataFrame } from '@grafana/data';

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

  return <TableWrap frame={logsFrame} />;
};
