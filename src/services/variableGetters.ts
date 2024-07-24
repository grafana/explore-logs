import { AdHocFiltersVariable, CustomVariable, sceneGraph, SceneObject } from '@grafana/scenes';
import { VAR_FIELDS, VAR_LABELS, VAR_LOGS_FORMAT } from './variables';

export function getLogsFormatVariable(sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LOGS_FORMAT, sceneRef);
  if (!(variable instanceof CustomVariable)) {
    throw new Error('Logs format variable not found');
  }
  return variable;
}

export function getLabelsVariable(sceneRef: SceneObject): AdHocFiltersVariable {
  const variable = sceneGraph.lookupVariable(VAR_LABELS, sceneRef);

  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error('Filters variable not found');
  }

  return variable;
}

export function getFieldsVariable(sceneRef: SceneObject): AdHocFiltersVariable {
  const variable = sceneGraph.lookupVariable(VAR_FIELDS, sceneRef);

  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error('Filters variable not found');
  }

  return variable;
}
