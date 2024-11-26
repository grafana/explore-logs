import React from 'react';
import { RadioButtonGroup } from '@grafana/ui';
import { LogsVisualizationType } from 'services/store';

/**
 * The options shared between logs and table panels
 * @param props
 * @constructor
 */
export function LogsPanelHeaderActions(props: {
  vizType: LogsVisualizationType;
  onChange: (type: LogsVisualizationType) => void;
}) {
  return (
    <RadioButtonGroup
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
  );
}
