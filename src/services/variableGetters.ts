import { CustomVariable, sceneGraph, SceneObject } from '@grafana/scenes';
import { VAR_LOGS_FORMAT } from './variables';

export function getLogsFormatVariable(sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LOGS_FORMAT, sceneRef);
  if (!(variable instanceof CustomVariable)) {
    throw new Error('Logs format variable not found');
  }
  return variable;
}
