import {
  getFieldsVariable,
  getLabelsVariable,
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS_EXPR,
  VAR_JSON_FORMAT_EXPR,
  VAR_LINE_FILTER_EXPR,
  VAR_LOGS_FORMAT_EXPR,
  VAR_MIXED_FORMAT_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';
import { isDefined } from './scenes';
import { SceneObject } from '@grafana/scenes';
import { renderLogQLLabelFilters } from './query';
import { getParserFromFieldsFilters } from './fields';

/**
 * Crafts count over time query that excludes empty values for stream selector name
 * Will only add parsers if there are filters that require them.
 * @param sceneRef
 * @param streamSelectorName - the name of the stream selector we are aggregating by
 * @param excludeEmpty - if true, the query will exclude empty values for the given streamSelectorName
 */
export function getTimeSeriesExpr(sceneRef: SceneObject, streamSelectorName: string, excludeEmpty = true): string {
  const labelsVariable = getLabelsVariable(sceneRef);
  const fieldsVariable = getFieldsVariable(sceneRef);

  let labelExpressionToAdd;
  let metadataExpressionToAdd = '';
  if (excludeEmpty) {
    // `LEVEL_VARIABLE_VALUE` is a special case where we don't want to add this to the stream selector
    if (streamSelectorName !== LEVEL_VARIABLE_VALUE) {
      labelExpressionToAdd = { key: streamSelectorName, operator: '!=', value: '' };
    } else {
      metadataExpressionToAdd = `| ${LEVEL_VARIABLE_VALUE} != ""`;
    }
  }

  const labelFilters = [...labelsVariable.state.filters, labelExpressionToAdd].filter(isDefined);
  const streamSelectors = renderLogQLLabelFilters(labelFilters);

  const fieldFilters = fieldsVariable.state.filters;
  const parser = getParserFromFieldsFilters(fieldsVariable);

  // if we have fields, we also need to add parsers
  if (fieldFilters.length) {
    if (parser === 'mixed') {
      return `sum(count_over_time({${streamSelectors}} ${metadataExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_MIXED_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'json') {
      return `sum(count_over_time({${streamSelectors}} ${metadataExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_JSON_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
    if (parser === 'logfmt') {
      return `sum(count_over_time({${streamSelectors}} ${metadataExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
    }
  }
  return `sum(count_over_time({${streamSelectors}} ${metadataExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} [$__auto])) by (${streamSelectorName})`;
}
