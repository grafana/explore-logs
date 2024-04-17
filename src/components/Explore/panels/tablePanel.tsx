import { PanelProps } from '@grafana/data';
import React from 'react';
import { TableProvider } from '@/components/Table/TableProvider';
import { VizPanel } from '@grafana/scenes';
import { ScenesTableContextProvider } from '@/components/Context/ScenesTableContext';
import { LogsVisualizationType, TablePanelProps } from '@/components/Explore/LogsByService/Tabs/LogsListScene';
import { RadioButtonGroup } from '@grafana/ui';
import { css } from '@emotion/css';

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

export function LogsPanelHeaderActions(props: {
  vizType: LogsVisualizationType;
  onChange: (type: LogsVisualizationType) => void;
}) {
  //@todo how to get theme?
  const styles = getStyles();

  return (
    <div className={styles.visualisationType}>
      <RadioButtonGroup
        className={styles.visualisationTypeRadio}
        options={[
          {
            label: 'Logs',
            value: 'logs',
            description: 'Show results in logs visualisation',
          },
          {
            label: 'Table',
            value: 'table',
            description: 'Show results in table visualisation',
          },
        ]}
        size="sm"
        value={props.vizType}
        onChange={props.onChange}
      />
    </div>
  );
}

export interface VizTypeProps {
  vizType: LogsVisualizationType;
  setVizType: (type: LogsVisualizationType) => void;
}

export const getTablePanel = (tableProps: TablePanelProps, vizTypeProps: VizTypeProps) => {
  // const search = new URLSearchParams(window.location.search);
  // const columnsFromUrl = search.get('tableColumns');
  //
  return new VizPanel({
    pluginId: LOGS_TABLE_PLUGIN_ID,
    options: tableProps,
    title: 'Logs',
    headerActions: <LogsPanelHeaderActions vizType={vizTypeProps.vizType} onChange={vizTypeProps.setVizType} />,
  });
};

const getStyles = () => {
  return {
    visualisationType: css({
      display: 'flex',
      flex: '1',
      justifyContent: 'space-between',
    }),
    visualisationTypeRadio: css({
      margin: `0 0 0 8px`,
    }),
  };
};
