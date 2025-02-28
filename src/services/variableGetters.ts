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
  isAdHocFilterValueUserInput,
  JSON_FORMAT_EXPR,
  LOGS_FORMAT_EXPR,
  LogsQueryOptions,
  MIXED_FORMAT_EXPR,
  SERVICE_NAME,
  stripAdHocFilterUserInputPrefix,
  VAR_AGGREGATED_METRICS,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_FIELDS_AND_METADATA,
  VAR_FIELDS_EXPR,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LABELS_REPLICA,
  VAR_LEVELS,
  VAR_LEVELS_EXPR,
  VAR_LINE_FILTER,
  VAR_LINE_FILTERS,
  VAR_LINE_FILTERS_EXPR,
  VAR_METADATA,
  VAR_METADATA_EXPR,
  VAR_PATTERNS,
  VAR_PATTERNS_EXPR,
  VAR_PRIMARY_LABEL,
  VAR_PRIMARY_LABEL_SEARCH,
} from './variables';
import { AdHocVariableFilter } from '@grafana/data';
import { logger } from './logger';
import { narrowFieldValue, NarrowingError } from './narrowing';
import { isFilterMetadata } from './filters';
import { AdHocFilterTypes, InterpolatedFilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';

export function getLogsStreamSelector(options: LogsQueryOptions) {
  const {
    labelExpressionToAdd = '',
    structuredMetadataToAdd = '',
    fieldExpressionToAdd = '',
    parser = undefined,
  } = options;

  switch (parser) {
    case 'structuredMetadata':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    case 'json':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${JSON_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    case 'logfmt':
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${LOGS_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
    default:
      return `{${VAR_LABELS_EXPR}${labelExpressionToAdd}} ${structuredMetadataToAdd} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${MIXED_FORMAT_EXPR} ${fieldExpressionToAdd} ${VAR_FIELDS_EXPR}`;
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

export function getMetadataVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_METADATA, scene);
}

// Combined fields and metadata, editable in the UI, changes to this variable flow into FIELDS and METADATA
export function getFieldsAndMetadataVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_FIELDS_AND_METADATA, scene);
}

export function getFieldsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_FIELDS, scene);
}

export function getLevelsVariable(scene: SceneObject) {
  return getAdHocFiltersVariable(VAR_LEVELS, scene);
}

export function getLineFilterVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LINE_FILTER, scene);
  if (!(variable instanceof AdHocFiltersVariable)) {
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

export function getLineFiltersVariable(scene: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LINE_FILTERS, scene);
  if (!(variable instanceof AdHocFiltersVariable)) {
    throw new Error('VAR_LINE_FILTERS not found');
  }
  return variable;
}

export function getAdHocFiltersVariable(variableName: AdHocFilterTypes, scene: SceneObject) {
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
  const variable = sceneGraph.lookupVariable(VAR_PRIMARY_LABEL, sceneRef);
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

/**
 * Parses an adHoc filter and returns the encoded value and parser
 * @param filter
 * @param variableName - only used for debugging
 */
export function getValueFromFieldsFilter(
  filter: { value: string; valueLabels?: string[] },
  variableName: string = VAR_FIELDS
): FieldValue {
  if (isFilterMetadata(filter)) {
    return {
      value: filter.value,
      parser: 'structuredMetadata',
    };
  }

  try {
    const encodedValue = isAdHocFilterValueUserInput(filter.value)
      ? stripAdHocFilterUserInputPrefix(filter.value)
      : filter.value;
    const fieldValue = narrowFieldValue(JSON.parse(encodedValue));
    if (fieldValue !== false) {
      return fieldValue;
    } else {
      throw new NarrowingError('getValueFromFieldsFilter: invalid filter value!');
    }
  } catch (e) {
    if (e instanceof NarrowingError) {
      logger.error(e, { msg: `getValueFromFieldsFilter: Failed to validate ${variableName}`, value: filter.value });
    } else {
      logger.error(e, { msg: `getValueFromFieldsFilter: Failed to parse ${variableName}`, value: filter.value });
    }

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
  variableName: InterpolatedFilterType,
  filter?: AdHocVariableFilter
): AdHocFieldValue {
  if (variableName === VAR_FIELDS && filter) {
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
