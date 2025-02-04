import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { usePluginComponent } from '@grafana/runtime';
import { VAR_LABELS } from 'services/variables';
import { getAdHocFiltersVariable } from 'services/variableGetters';
import { AdHocVariableFilter } from '@grafana/data';
import { getDataSource } from 'services/scenes';

interface LogsVolumeActionsState extends SceneObjectState {}

export class LogsVolumeActions extends SceneObjectBase<LogsVolumeActionsState> {
  static Component = Component;
}

type StreamSelector = Pick<AdHocVariableFilter, 'key' | 'operator' | 'value'>;

type TemporaryExemptionsProps = {
  /** An ordered list of lower-case [a-z]+ string identifiers to provide context clues of where this component is being embedded and how we might want to consider displaying it */
  contextHints?: string[];
  /** Currently selected data source */
  dataSourceUid?: string;
  /** The stream selector, broken down into a list of structured subselector filter items */
  streamSelector?: StreamSelector[];
};

function Component({ model }: SceneComponentProps<LogsVolumeActions>) {
  const { component: TemporaryExemptionsButton, isLoading } = usePluginComponent<TemporaryExemptionsProps>(
    'grafana-adaptivelogs-app/temporary-exemptions/v1'
  );

  const labelsVar = getAdHocFiltersVariable(VAR_LABELS, model);
  const { filters } = labelsVar.useState();
  const streamSelector = filters.map(({ key, operator, value }: AdHocVariableFilter) => ({ key, operator, value }));

  const dataSourceUid = getDataSource(model);

  if (isLoading || !TemporaryExemptionsButton) {
    return null;
  }

  return (
    <TemporaryExemptionsButton
      dataSourceUid={dataSourceUid}
      streamSelector={streamSelector}
      contextHints={['explorelogs', 'logvolumepanel', 'headeraction']}
    />
  );
}
