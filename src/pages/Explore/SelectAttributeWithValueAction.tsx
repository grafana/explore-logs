import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState, VariableValueSelectors,
} from '@grafana/scenes';
import {Button} from '@grafana/ui';

import {StartingPointSelectedEvent, VAR_DATASOURCE} from '../../utils/shared';
import {addToFavoriteServicesInStorage} from 'utils/store';
import {LogExploration} from "./LogExploration";
import {VariableHide} from "@grafana/schema";

export interface SelectAttributeWithValueActionState extends SceneObjectState {
  value: string;
}

export class SelectAttributeWithValueAction extends SceneObjectBase<SelectAttributeWithValueActionState> {
  public onClick = () => {
    const logExploration = sceneGraph.getAncestor(this, LogExploration);
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
      hide: VariableHide.dontHide,
    });

    // Hacky? When we hide the variable it renders as null so it won't react to state changes anymore, thus we re-creat the variable renderer
    // TODO update scenes to listen to state changes when variable is hidden
    const newControls = logExploration.state.controls;
    newControls[0] = new VariableValueSelectors({ layout: 'vertical' });
    logExploration.setState({controls: newControls})

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
