import { CustomVariable, DataSourceVariable, sceneGraph, SceneObject } from '@grafana/scenes';
import { getAdHocFiltersVariable } from './scenes';
import { CustomConstantVariable } from './CustomConstantVariable';

export const VAR_LABELS = 'filters';
export const VAR_LABELS_EXPR = '${filters}';
export const VAR_FIELDS = 'fields';
export const VAR_FIELDS_EXPR = '${fields}';
export const VAR_PATTERNS = 'patterns';
export const VAR_PATTERNS_EXPR = '${patterns}';
export const VAR_FIELD_GROUP_BY = 'fieldBy';
export const VAR_LABEL_GROUP_BY = 'labelBy';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_FORMAT = 'logsFormat';
export const VAR_LOGS_FORMAT_EXPR = '${logsFormat}';
export const VAR_LINE_FILTER = 'lineFilter';
export const VAR_LINE_FILTER_EXPR = '${lineFilter}';
export const LOG_STREAM_SELECTOR_EXPR = `${VAR_LABELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FILTER_EXPR}`;
export const EXPLORATION_DS = { uid: VAR_DATASOURCE_EXPR };
export const ALL_VARIABLE_VALUE = '$__all';
export const LEVEL_VARIABLE_VALUE = 'detected_level';
export const PATTERNS_TEXT_FILTER = 'patternsFilter';

export function getPatternsVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_PATTERNS, scene);
  if (variable instanceof CustomVariable) {
    return variable;
  }
  return null;
}

export function getLabelsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_LABELS, scene);
}

export function getFieldsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_FIELDS, scene);
}

export function getLineFilterVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LINE_FILTER, scene);
  if (variable instanceof CustomVariable) {
    return variable;
  }
  return null;
}

export function getLabelGroupByVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, scene);
  if (variable instanceof CustomConstantVariable) {
    return variable;
  }
  return null;
}

export function getFieldGroupByVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUP_BY, scene);
  if (variable instanceof CustomConstantVariable) {
    return variable;
  }
  return null;
}

export function getDataSourceVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_DATASOURCE, scene);
  if (variable instanceof DataSourceVariable) {
    return variable;
  }
  return null;
}
