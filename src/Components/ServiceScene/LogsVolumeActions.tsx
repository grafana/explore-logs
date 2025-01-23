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

type SelectorFilterItem = Pick<AdHocVariableFilter, 'key' | 'operator' | 'value'>;

type TemporaryExemptionsProps = {
  /** Currently selected data source */
  dataSourceUid?: string;
  /** The selector fields that we are considering temporary exemptions for */
  selectorFilters?: SelectorFilterItem[];
  /** A list of string identifiers to provide context cue of where this component is being embedded and how we might want to consider displaying it */
  contextHints?: string[];
};

function Component({ model }: SceneComponentProps<LogsVolumeActions>) {
  const { component: TemporaryExemptionsButton, isLoading } = usePluginComponent<TemporaryExemptionsProps>(
    'grafana-adaptivelogs-app/temporary-exemptions/v1'
  );

  const labelsVar = getAdHocFiltersVariable(VAR_LABELS, model);
  const { filters } = labelsVar.useState();
  const selectorFilters = filters.map(({ key, operator, value }: AdHocVariableFilter) => ({ key, operator, value }));

  const dataSourceUid = getDataSource(model);

  if (isLoading || !TemporaryExemptionsButton) {
    return null;
  }

  return (
    <TemporaryExemptionsButton
      dataSourceUid={dataSourceUid}
      selectorFilters={selectorFilters}
      contextHints={['log-volume-panel', 'header-action']}
    />
  );
}
