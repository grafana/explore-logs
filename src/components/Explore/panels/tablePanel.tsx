import { PanelProps } from '@grafana/data';
import React from 'react';
import { TableProvider } from '@/components/Table/TableProvider';
import { VizPanel } from '@grafana/scenes';
import { ScenesTableContextProvider } from '@/components/Context/ScenesTableContext';
import { TablePanelProps } from '@/components/Explore/LogsByService/Tabs/LogsListScene';

export interface CustomTableFieldOptions {
  numericOption: number;
}

interface Props extends PanelProps<TablePanelProps> {}
export const LOGS_TABLE_PLUGIN_ID = 'logs-table';

export function CustomTablePanel(props: Props) {
  const { data, options } = props;

  return (
    <ScenesTableContextProvider {...options}>
      <TableProvider dataFrame={data.series[0]} />
    </ScenesTableContextProvider>
  );
}

export const getTablePanel = (props: TablePanelProps) => {
  return new VizPanel({
    pluginId: LOGS_TABLE_PLUGIN_ID,
    options: props,
  });
};
