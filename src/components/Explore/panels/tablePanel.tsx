import { PanelProps } from '@grafana/data';
import React from 'react';
import { TableProvider } from '@/components/Table/TableProvider';
import { VizPanel } from '@grafana/scenes';
import { QueryContextProvider } from '@/components/Context/QueryContext';
import { LabelsContextProvider } from '@/components/Context/LabelsContext';

export interface CustomTableOptions {
  mode: string;
}

export interface CustomTableFieldOptions {
  numericOption: number;
}

interface Props extends PanelProps<CustomTableOptions> {}

export function CustomTablePanel(props: Props) {
  const { data } = props;

  return (
    <QueryContextProvider>
      <LabelsContextProvider>
        <TableProvider dataFrame={data.series[0]} />
      </LabelsContextProvider>
    </QueryContextProvider>
  );
}

export const getTablePanel = () => {
  return new VizPanel({
    pluginId: 'custom-table-viz',
  });
};
