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
import { addToFavoriteServicesInStorage } from 'services/store';
import { VAR_DATASOURCE } from 'services/variables';
import { SERVICE_NAME, StartingPointSelectedEvent } from './ServiceSelectionScene';
import { reportAppInteraction } from 'services/analytics';

export interface SelectFieldButtonState extends SceneObjectState {
  value: string;
}

export class SelectFieldButton extends SceneObjectBase<SelectFieldButtonState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable('filters', this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    if (!this.state.value) {
      return;
    }

    reportAppInteraction('service_selection', 'service_selected', {
      service: this.state.value,
    });

    variable.setState({
      filters: [
        ...variable.state.filters,
        {
          key: SERVICE_NAME,
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

  public static Component = ({ model }: SceneComponentProps<SelectFieldButton>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
