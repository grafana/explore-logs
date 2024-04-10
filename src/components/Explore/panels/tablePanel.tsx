import { AdHocVariableFilter, PanelProps } from '@grafana/data';
import React from 'react';
import { TableProvider } from '@/components/Table/TableProvider';
import { VizPanel } from '@grafana/scenes';
import { LokiDatasource } from '@/services/lokiTypes';
import { ScenesTableContextProvider } from '@/components/Context/ScenesTableContext';

export interface CustomTableOptions {
  filters: AdHocVariableFilter[];
  datasource: LokiDatasource | undefined;
  addFilter: (filter: AdHocVariableFilter) => void;
}

export interface CustomTableFieldOptions {
  numericOption: number;
}

interface Props extends PanelProps<CustomTableOptions> {}

export function CustomTablePanel(props: Props) {
  const { data, options } = props;

  // need labels, datasource,

  return (
    <ScenesTableContextProvider addFilter={options.addFilter} filters={options.filters} dataSource={options.datasource}>
      <TableProvider dataFrame={data.series[0]} />
    </ScenesTableContextProvider>
  );
}

export const getTablePanel = (filters: AdHocVariableFilter[], addFilter: (filter: AdHocVariableFilter) => void) => {
  const options: CustomTableOptions = {
    datasource: undefined,
    filters: filters,
    addFilter,
  };

  return new VizPanel({
    pluginId: 'custom-table-viz',
    options: options,
  });
};
