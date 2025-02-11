import { AdHocFiltersVariable, sceneGraph, SceneObject, SceneVariable } from '@grafana/scenes';
import { CustomConstantVariable } from './CustomConstantVariable';
import { SERVICE_NAME, SERVICE_UI_LABEL, VAR_LABELS } from './variables';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { getPrimaryLabelFromUrl } from './routing';
import { FilterOp } from './filterTypes';
import { includeOperators, numericOperators, operators } from './operators';
import { isOperatorInclusive } from './operatorHelpers';

export function getVariablesThatCanBeCleared(indexScene: IndexScene) {
  const variables = sceneGraph.getVariables(indexScene);
  let variablesToClear: SceneVariable[] = [];

  for (const variable of variables.state.variables) {
    if (variable instanceof AdHocFiltersVariable && variable.state.filters.length) {
      variablesToClear.push(variable);
    }
    if (variable instanceof CustomConstantVariable && variable.state.value && variable.state.name !== 'logsFormat') {
      variablesToClear.push(variable);
    }
  }
  return variablesToClear;
}

export function clearVariables(sceneRef: SceneObject) {
  // clear patterns: needs to happen first, or it won't work as patterns is split into a variable and a state, and updating the variable triggers a state update
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  indexScene.setState({
    patterns: [],
  });

  const variablesToClear = getVariablesThatCanBeCleared(indexScene);

  variablesToClear.forEach((variable) => {
    if (variable instanceof AdHocFiltersVariable && variable.state.key === 'adhoc_service_filter') {
      let { labelName } = getPrimaryLabelFromUrl();
      // getPrimaryLabelFromUrl returns the label name that exists in the URL, which is "service" not "service_name"
      if (labelName === SERVICE_UI_LABEL) {
        labelName = SERVICE_NAME;
      }
      variable.setState({
        filters: variable.state.filters.filter((filter) => filter.key === labelName),
      });
    } else if (variable instanceof AdHocFiltersVariable) {
      variable.setState({
        filters: [],
      });
    } else if (variable instanceof CustomConstantVariable) {
      variable.setState({
        value: '',
        text: '',
      });
    }
  });
}

export const operatorFunction = function (variable: AdHocFiltersVariable) {
  const wip = variable.state._wip;

  // If there is already a non-regex inclusion operator for this key, don't allow exclusion
  if (wip && variable.state.filters.some((filter) => filter.key === wip.key && filter.operator === FilterOp.Equal)) {
    return includeOperators;
  }

  const isLabelsVar = variable.state.name === VAR_LABELS;
  const inclusiveOperatorCount = variable.state.filters.filter((filter) => isOperatorInclusive(filter.operator)).length;
  const isEditingOnlyFilter = !wip?.key && inclusiveOperatorCount === 1;
  const isAddingFirstFilter = wip?.key && inclusiveOperatorCount < 1;

  // Should not be able to exclude the only operator
  if (isLabelsVar && (isEditingOnlyFilter || isAddingFirstFilter)) {
    return includeOperators;
  }

  // Only fields or metadata can have field types?
  if (wip?.meta) {
    const meta: Record<string, string> = wip.meta;
    const type = meta.type;

    if (type === 'float' || type === 'bytes' || type === 'duration') {
      return numericOperators;
    }
  }

  return operators;
};
