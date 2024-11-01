import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  sceneGraph,
  SceneObject,
  SceneVariableState,
} from '@grafana/scenes';
import { CustomConstantVariable } from './CustomConstantVariable';
import {
  AdHocFieldValue,
  FieldValue,
  JSON_FORMAT_EXPR,
  LOGS_FORMAT_EXPR,
  LogsQueryOptions,
  MIXED_FORMAT_EXPR,
  VAR_AGGREGATED_METRICS,
  SERVICE_NAME,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_FIELDS_EXPR,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_LEVELS_EXPR,
  VAR_LINE_FILTER,
  VAR_LINE_FILTER_EXPR,
  VAR_PATTERNS,
  VAR_PATTERNS_EXPR,
  VAR_SERVICE_SELECTION_TAB,
  VAR_PRIMARY_LABEL_SEARCH,
  VAR_METADATA_EXPR,
  VAR_METADATA,
  VAR_LABELS_REPLICA,
} from './variables';
import { AdHocVariableFilter } from '@grafana/data';
import { logger } from './logger';

export function getLogsStreamSelector(options: LogsQueryOptions) {
  const {
    labelExpressionToAdd = '',
    structuredMetadataToAdd = '',
    fieldExpressionToAdd = '',
    parser = undefined,
  } = options;

  switch (parser) {
    case 'structuredMetadata':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_METADATA_EXPR} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    case 'json':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_METADATA_EXPR} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${JSON_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    case 'logfmt':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_METADATA_EXPR} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${LOGS_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    default:
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_METADATA_EXPR} ${VAR_LEVELS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${MIXED_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
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

export function getLabelsVariableReplica(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_LABELS_REPLICA, scene);
}

export function getFieldsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_FIELDS, scene);
}

export function getMetadataVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_METADATA, scene);
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

export function getAggregatedMetricsVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_AGGREGATED_METRICS, scene);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('SERVICE_LABEL_VAR not found');
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

export function getServiceSelectionSearchVariable(sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_PRIMARY_LABEL_SEARCH, sceneRef);
  if (!(variable instanceof CustomConstantVariable)) {
    throw new Error('VAR_PRIMARY_LABEL_SEARCH not found');
  }
  return variable;
}

export function clearServiceSelectionSearchVariable(sceneRef: SceneObject) {
  getServiceSelectionSearchVariable(sceneRef).setState({
    value: '.+',
    label: '',
  });
}

export function getServiceSelectionPrimaryLabel(sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_SERVICE_SELECTION_TAB, sceneRef);
  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error('VAR_PRIMARY_LABEL not found');
  }
  return variable;
}

export function setServiceSelectionPrimaryLabelKey(key: string, sceneRef: SceneObject) {
  getServiceSelectionPrimaryLabel(sceneRef).setState({
    filters: [
      {
        // the value is replaced by the value in VAR_PRIMARY_LABEL_SEARCH if a search is active, so we just need to set the filter key (label name)
        value: '.+',
        operator: '=~',
        key: key,
      },
    ],
  });
}

export function getUrlParamNameForVariable(variableName: string) {
  return `var-${variableName}`;
}

export function getValueFromFieldsFilter(filter: AdHocVariableFilter, variableName: string = VAR_FIELDS): FieldValue {
  try {
    return JSON.parse(filter.value);
  } catch (e) {
    logger.warn(`Failed to parse ${variableName}`, { value: filter.value });

    // If the user has a URL from before 0.1.4 where detected_fields changed the format of the fields value to include the parser, fall back to mixed parser if we have a value
    if (filter.value) {
      return {
        value: filter.value,
        parser: 'mixed',
      };
    }
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
