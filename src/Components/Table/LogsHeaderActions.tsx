import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { css } from '@emotion/css';
import { LogsVisualizationType } from '../ServiceScene/LogsListScene';

export const LOGS_TABLE_PLUGIN_ID = 'logs-table';

export function LogsPanelHeaderActions(props: {
  vizType: LogsVisualizationType;
  onChange: (type: LogsVisualizationType) => void;
}) {
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

const getStyles = () => {
  return {
    visualisationType: css({
      display: 'flex',
      flex: '1',
      justifyContent: 'space-between',
      marginTop: '8px',
    }),
    visualisationTypeRadio: css({
      margin: `0 0 0 8px`,
    }),
  };
};
