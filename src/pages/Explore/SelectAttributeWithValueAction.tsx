import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { addToFavoriteServicesInStorage } from 'utils/store';
import { VAR_DATASOURCE, StartingPointSelectedEvent } from 'utils/shared';

export interface SelectAttributeWithValueActionState extends SceneObjectState {
  value: string;
}

export class SelectAttributeWithValueAction extends SceneObjectBase<SelectAttributeWithValueActionState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable('filters', this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    if (!this.state.value) {
      return;
    }

    variable.setState({
      filters: [
        ...variable.state.filters,
        {
          key: 'service_name',
          operator: '=',
          value: this.state.value,
        },
      ],
      hide: VariableHide.hideLabel,
    });
    const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
    addToFavoriteServicesInStorage(ds, this.state.value);

    this.publishEvent(new StartingPointSelectedEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectAttributeWithValueAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
