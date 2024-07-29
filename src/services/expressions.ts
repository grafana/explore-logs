import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFilterVariable,
  getPatternsVariable,
  LEVEL_VARIABLE_VALUE,
  SERVICE_NAME,
  VAR_FIELDS_EXPR,
  VAR_LINE_FILTER_EXPR,
  VAR_LOGS_FORMAT_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';
import { isDefined } from './scenes';
import { SceneObject } from '@grafana/scenes';

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
  const levelsVariables = getLevelsVariable(sceneRef);

  let labelExpressionToAdd;
  let fieldExpressionToAdd = '';
  if (excludeEmpty) {
    // `LEVEL_VARIABLE_VALUE` is a special case where we don't want to add this to the stream selector
    if (streamSelectorName !== LEVEL_VARIABLE_VALUE) {
      labelExpressionToAdd = { key: streamSelectorName, operator: '!=', value: '' };
    } else {
      fieldExpressionToAdd = `| ${LEVEL_VARIABLE_VALUE} != ""`;
    }
  }

  const streamSelectors = [...labelsVariable.state.filters, labelExpressionToAdd]
    .filter(isDefined)
    .map((f) => `${f.key}${f.operator}\`${f.value}\``)
    .join(',');

  const fields = fieldsVariable.state.filters;
  const levels = levelsVariables.state.filters;

  // if we have fields, we also need to add `VAR_LOGS_FORMAT_EXPR`
  if (fields.length || levels.length) {
    return `sum(count_over_time({${streamSelectors}} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
  }

  // if we have a single service selector and the stream selector is `LEVEL_VARIABLE_VALUE`, we can use aggregated metrics for the whole service
  if (hasSingleServiceSelector(sceneRef) && streamSelectorName === LEVEL_VARIABLE_VALUE) {
    return `sum(sum_over_time({__aggregated_metric__=\`${service(
      sceneRef
    )}\`} | logfmt | unwrap count [$__auto])) by (${streamSelectorName})`;
  }

  // otherwise, if we have a single service selector and the stream selector is something else, we can use aggregated metrics for that specific selector
  if (hasSingleServiceSelector(sceneRef)) {
    return `sum(sum_over_time({__aggregated_metric__=\`${service(
      sceneRef
    )}\`} | logfmt |${streamSelectorName} != "" | unwrap count [$__auto])) by (${streamSelectorName})`;
  }

  // finally, we are in the case where we have too specific of selectors to use aggregated metrics, so we need to use the regular count_over_time
  return `sum(count_over_time({${streamSelectors}} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} [$__auto])) by (${streamSelectorName})`;
}

function service(sceneRef: SceneObject): string {
  const labelsVariable = getLabelsVariable(sceneRef);
  const filters = labelsVariable?.state.filters ?? [];

  return filters.find((filter) => filter.key === SERVICE_NAME)?.value ?? '';
}

function hasSingleServiceSelector(sceneRef: SceneObject): boolean {
  const patternsVariable = getPatternsVariable(sceneRef);
  const lineFilterVariable = getLineFilterVariable(sceneRef);
  const labelsVariable = getLabelsVariable(sceneRef);

  if (patternsVariable.state.value !== '') {
    return false;
  }

  if (labelsVariable.state.filters.length > 1) {
    return false;
  }

  const filter = (lineFilterVariable.state.value as string).trim();

  // only return true if there is a single label filter for the service name and empty line filter expression
  if (labelsVariable.state.filters[0].key === SERVICE_NAME) {
    if (filter === '|~ `(?i)`' || !filter) {
      return true;
    }
  }

  return false;
}
