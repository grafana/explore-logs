import {
  ControlsLayout,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VariableValueSelectWrapper,
} from '@grafana/scenes';
import React from 'react';

export interface VariableValueSelectorsState extends SceneObjectState {
  layout?: ControlsLayout;
  includeNames?: string[];
  excludeNames?: string[];
}

export class CustomVariableValueSelectors extends SceneObjectBase<VariableValueSelectorsState> {
  public static Component = CustomVariableValueSelectorsRenderer;
}

function CustomVariableValueSelectorsRenderer({ model }: SceneComponentProps<CustomVariableValueSelectors>) {
  const variablesSetState = sceneGraph.getVariables(model).useState();
  let variables = variablesSetState.variables;

  if (model.state.includeNames?.length) {
    variables = variablesSetState.variables.filter((variable) =>
      model.state.includeNames?.includes(variable.state.name ?? '')
    );
  }
  if (model.state.excludeNames?.length) {
    variables = variablesSetState.variables.filter(
      (variable) => !model.state.excludeNames?.includes(variable.state.name ?? '')
    );
  }

  return (
    <>
      {variables.map((variable) => (
        <VariableValueSelectWrapper key={variable.state.key} variable={variable} layout={model.state.layout} />
      ))}
    </>
  );
}
