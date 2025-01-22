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

type TemporaryExemptionsButtonProps = {
  dataSourceUid?: string;
  selectorFilters?: SelectorFilterItem[];
};

function Component({ model }: SceneComponentProps<LogsVolumeActions>) {
  const { component: TemporaryExemptionsButton, isLoading } = usePluginComponent<TemporaryExemptionsButtonProps>(
    'grafana-adaptivelogs-app/temporary-exemptions-button/v1'
  );

  const labelsVar = getAdHocFiltersVariable(VAR_LABELS, model);
  const { filters } = labelsVar.useState();
  const selectorFilters = filters.map(({ key, operator, value }: AdHocVariableFilter) => ({ key, operator, value }));

  const dataSourceUid = getDataSource(model);

  if (isLoading || !TemporaryExemptionsButton) {
    return null;
  }

  return <TemporaryExemptionsButton dataSourceUid={dataSourceUid} selectorFilters={selectorFilters} />;
}
