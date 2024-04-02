import React from 'react';

import { TableWrap } from '../Table/TableWrap';
import { parseLogsFrame } from '../services/logsFrame';
import { DataFrame } from '@grafana/data';

export const TableProvider = ({ dataFrame }: { dataFrame?: DataFrame }) => {
  console.log('tableProvider', dataFrame);
  if (!dataFrame) {
    return null;
  }

  const logsFrame = parseLogsFrame(dataFrame);
  if (!logsFrame) {
    return null;
  }

  return <TableWrap frame={logsFrame} />;
};
