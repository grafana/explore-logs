import React from 'react';

import {DataFrame} from '@grafana/data';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState, VariableValueSelectors,
} from '@grafana/scenes';
import {Button} from '@grafana/ui';
import {VariableHide} from "@grafana/schema";
import {LogExploration} from "../../pages/Explore";

export interface AddToFiltersGraphActionState extends SceneObjectState {
  frame: DataFrame;
  variableName: string;
}

export class AddToFiltersGraphAction extends SceneObjectBase<AddToFiltersGraphActionState> {
  public onClick = () => {
    const logExploration = sceneGraph.getAncestor(this, LogExploration);
    const variable = sceneGraph.lookupVariable(this.state.variableName, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    const labels = this.state.frame.fields[1]?.labels ?? {};
    if (Object.keys(labels).length !== 1) {
      return;
    }

    const labelName = Object.keys(labels)[0];

    variable.setState({
      filters: [
        ...variable.state.filters,
        {
          key: labelName,
          operator: '=',
          value: labels[labelName],
        },
      ],
      hide: VariableHide.dontHide,
    });

    // Hacky? When we hide the variable it renders as null so it won't react to state changes anymore, thus we re-creat the variable renderer
    // TODO update scenes to listen to state changes when variable is hidden
    const newControls = logExploration.state.controls;
    newControls[0] = new VariableValueSelectors({ layout: 'vertical' });
    logExploration.setState({controls: newControls})
  };


  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Add to filters
      </Button>
    );
  };
}
