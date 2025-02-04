import {
  DETECTED_FIELD_AND_METADATA_VALUES_EXPR,
  DETECTED_LEVELS_VALUES_EXPR,
  JSON_FORMAT_EXPR,
  LEVEL_VARIABLE_VALUE,
  LOGS_FORMAT_EXPR,
  MIXED_FORMAT_EXPR,
  VAR_FIELDS_AND_METADATA,
  VAR_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_LINE_FILTERS_EXPR,
  VAR_METADATA_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';
import { SceneObject } from '@grafana/scenes';
import { getParserFromFieldsFilters } from './fields';
import { getFieldsVariable } from './variableGetters';
import { UIVariableFilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { logger } from './logger';

/**
 * Crafts count over time query that excludes empty values for stream selector name
 * Will only add parsers if there are filters that require them.
 * @param sceneRef
 * @param streamSelectorName - the name of the stream selector we are aggregating by
 * @param excludeEmpty - if true, the query will exclude empty values for the given streamSelectorName
 */
export function getTimeSeriesExpr(sceneRef: SceneObject, streamSelectorName: string, excludeEmpty = true): string {
  const fieldsVariable = getFieldsVariable(sceneRef);

  let metadataExpressionToAdd = '';
  if (excludeEmpty) {
    // `LEVEL_VARIABLE_VALUE` is a special case where we don't want to add this to the stream selector
    if (streamSelectorName === LEVEL_VARIABLE_VALUE) {
      metadataExpressionToAdd = `| ${LEVEL_VARIABLE_VALUE} != ""`;
    }
  }

  const fieldFilters = fieldsVariable.state.filters;
  const parser = getParserFromFieldsFilters(fieldsVariable);

  // if we have fields, we also need to add parsers
  if (fieldFilters.length) {
    if (parser === 'mixed') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${metadataExpressionToAdd} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${MIXED_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'json') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${metadataExpressionToAdd} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${JSON_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'logfmt') {
      return `sum(count_over_time({${VAR_LABELS_EXPR}} ${metadataExpressionToAdd} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
  }
  return `sum(count_over_time({${VAR_LABELS_EXPR}} ${metadataExpressionToAdd} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
}

/**
 * Get expressions for UI variables
 * @param variableType
 */
export function getFieldsTagValuesExpression(variableType: UIVariableFilterType) {
  switch (variableType) {
    case VAR_LEVELS:
      return DETECTED_LEVELS_VALUES_EXPR;
    case VAR_FIELDS_AND_METADATA:
      return DETECTED_FIELD_AND_METADATA_VALUES_EXPR;
    default:
      const error = new Error(`Unknown variable type: ${variableType}`);
      logger.error(error, {
        variableType,
        msg: `getFieldsTagValuesExpression: Unknown variable type: ${variableType}`,
      });
      throw error;
  }
}
