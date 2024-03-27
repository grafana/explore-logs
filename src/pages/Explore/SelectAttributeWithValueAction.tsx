import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';

import { StartingPointSelectedEvent } from '../../utils/shared';

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
          key: 'service',
          operator: '=',
          value: this.state.value,
        },
      ],
    });
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
