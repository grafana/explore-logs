import { PanelProps } from '@grafana/data';
import React from 'react';
import { TableProvider } from '@/components/Table/TableProvider';
import { VizPanel } from '@grafana/scenes';
import { ScenesTableContextProvider } from '@/components/Context/ScenesTableContext';
import { TablePanelProps } from '@/components/Explore/LogsByService/Tabs/LogsListScene';

export interface CustomTableFieldOptions {}

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
  console.log('getTablePanel', props);
  const search = new URLSearchParams(window.location.search);
  const columnsFromUrl = search.get('tableColumns');

  // Hack
  if (columnsFromUrl && !props.selectedColumns?.length) {
    props.selectedColumns = JSON.parse(columnsFromUrl);
  }

  return new VizPanel({
    pluginId: LOGS_TABLE_PLUGIN_ID,
    options: props,
  });
};
