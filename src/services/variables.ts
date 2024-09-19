import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  sceneGraph,
  SceneObject,
  SceneVariableState,
} from '@grafana/scenes';
import { CustomConstantVariable } from './CustomConstantVariable';
import { AdHocVariableFilter } from '@grafana/data';
import { AdHocFieldValue, FieldValue } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { logger } from './logger';

export const VAR_LABELS = 'filters';
export const VAR_LABELS_EXPR = '${filters}';
export const VAR_FIELDS = 'fields';
export const VAR_FIELDS_EXPR = '${fields}';
export const VAR_PATTERNS = 'patterns';
export const VAR_PATTERNS_EXPR = '${patterns}';
export const VAR_LEVELS = 'levels';
export const VAR_LEVELS_EXPR = '${levels}';
export const VAR_FIELD_GROUP_BY = 'fieldBy';
export const VAR_LABEL_GROUP_BY = 'labelBy';
export const VAR_LABEL_GROUP_BY_EXPR = '${labelBy}';
export const VAR_SERVICE = 'service';
export const VAR_SERVICE_EXPR = '${service}';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const MIXED_FORMAT_EXPR = `| json | logfmt | drop __error__, __error_details__`;
export const JSON_FORMAT_EXPR = `| json | drop __error__, __error_details__`;
export const LOGS_FORMAT_EXPR = `| logfmt`;
// This variable is hardcoded to the value of MIXED_FORMAT_EXPR. This is a hack to get logs context working, we don't want to use a variable for a value that doesn't change and cannot be updated by the user.
export const VAR_LOGS_FORMAT = 'logsFormat';
export const VAR_LOGS_FORMAT_EXPR = '${logsFormat}';
export const VAR_LINE_FILTER = 'lineFilter';
export const VAR_LINE_FILTER_EXPR = '${lineFilter}';
export const LOG_STREAM_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${VAR_LEVELS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR}`;
export const PATTERNS_SAMPLE_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR}`;
export const EXPLORATION_DS = { uid: VAR_DATASOURCE_EXPR };
export const ALL_VARIABLE_VALUE = '$__all';
export const LEVEL_VARIABLE_VALUE = 'detected_level';
export const SERVICE_NAME = 'service_name';
export const SERVICE_NAME_VAR = 'service_name_var';
export const SERVICE_NAME_EXPR = '${service_name_var}';
export const EMPTY_VARIABLE_VALUE = '""';

export type ParserType = 'logfmt' | 'json' | 'mixed' | 'structuredMetadata';

export type LogsQueryOptions = {
  labelExpressionToAdd?: string;
  structuredMetadataToAdd?: string;
  fieldExpressionToAdd?: string;
  parser?: ParserType;
};

export function getLogsStreamSelector(options: LogsQueryOptions) {
  const {
    labelExpressionToAdd = '',
    structuredMetadataToAdd = '',
    fieldExpressionToAdd = '',
    parser = undefined,
  } = options;

  switch (parser) {
    case 'structuredMetadata':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR}`;
    case 'json':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${JSON_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    case 'logfmt':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${LOGS_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    default:
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${MIXED_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
  }
}

export function getPatternsVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_PATTERNS, scene);
  if (!(variable instanceof CustomVariable)) {
    throw new Error('VAR_PATTERNS not found');
  }
  return variable;
}

export function getLabelsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_LABELS, scene);
}

export function getFieldsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_FIELDS, scene);
}

export function getLevelsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_LEVELS, scene);
}

export function getLineFilterVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LINE_FILTER, scene);
  if (!(variable instanceof CustomVariable)) {
    throw new Error('VAR_LINE_FILTER not found');
  }
  return variable;
}

export function getLabelGroupByVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, scene);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('VAR_LABEL_GROUP_BY not found');
  }
  return variable;
}

export function getServiceNameVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(SERVICE_NAME_VAR, scene);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('SERVICE_NAME_VAR not found');
  }
  return variable;
}

export function getFieldGroupByVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUP_BY, scene);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('VAR_FIELD_GROUP_BY not found');
  }
  return variable;
}

export function getDataSourceVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_DATASOURCE, scene);
  if (!(variable instanceof DataSourceVariable)) {
    throw new Error('VAR_DATASOURCE not found');
  }
  return variable;
}

export function getAdHocFiltersVariable(variableName: string, scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(variableName, scene);

  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error(`Could not get AdHocFiltersVariable ${variableName}. Variable not found.`);
  }
  return variable;
}

export function getServiceSelectionStringVariable(sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_SERVICE, sceneRef);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('VAR_SERVICE not found');
  }
  return variable;
}

export function getUrlParamNameForVariable(variableName: string) {
  return `var-${variableName}`;
}

export function getValueFromFieldsFilter(filter: AdHocVariableFilter, variableName: string = VAR_FIELDS): FieldValue {
  try {
    return JSON.parse(filter.value);
  } catch (e) {
    logger.error(e, { msg: `Failed to parse ${variableName}` });
    throw e;
  }
}

export function getValueFromAdHocVariableFilter(
  variable: AdHocFiltersVariable,
  filter?: AdHocVariableFilter
): AdHocFieldValue {
  if (variable.state.name === VAR_FIELDS && filter) {
    return getValueFromFieldsFilter(filter);
  }

  return {
    value: filter?.value,
  };
}

export function getServiceName(scene: SceneObject) {
  const labelsVariable = getLabelsVariable(scene);
  return getServiceNameFromVariableState(labelsVariable.state);
}

export function getServiceNameFromVariableState(
  adHocFiltersVariableState: SceneVariableState & { filters: AdHocVariableFilter[] }
) {
  const serviceName = adHocFiltersVariableState.filters
    .filter((filter) => filter.key === SERVICE_NAME)
    .map((filter) => filter.value);

  if (!serviceName) {
    throw new Error('Service present in filters selected');
  }
  return serviceName[0];
}

export function getDataSourceName(scene: SceneObject) {
  const dsVariable = getDataSourceVariable(scene);
  return dsVariable.getValue();
}
