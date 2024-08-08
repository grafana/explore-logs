import {
  getFieldsVariable,
  getLevelsVariable,
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS_EXPR,
  VAR_LABELS_EXPR,
  VAR_LINE_FILTER_EXPR,
  VAR_LOGS_FORMAT_EXPR,
  VAR_PATTERNS_EXPR,
} from './variables';
import { SceneObject } from '@grafana/scenes';

/**
 * Crafts count over time query that excludes empty values for stream selector name
 * Will only add parsers if there are filters that require them.
 * @param sceneRef
 * @param streamSelectorName - the name of the stream selector we are aggregating by
 * @param excludeEmpty - if true, the query will exclude empty values for the given streamSelectorName
 */
export function getTimeSeriesExpr(sceneRef: SceneObject, streamSelectorName: string, excludeEmpty = true): string {
  const fieldsVariable = getFieldsVariable(sceneRef);
  const levelsVariables = getLevelsVariable(sceneRef);

  let fieldExpressionToAdd = '';
  if (excludeEmpty) {
    // `LEVEL_VARIABLE_VALUE` is a special case where we don't want to add this to the stream selector
    if (streamSelectorName === LEVEL_VARIABLE_VALUE) {
      fieldExpressionToAdd = `| ${LEVEL_VARIABLE_VALUE} != ""`;
    } else {
      // @todo why did I have to add this to remove "no labels"? Probably because we're not manually building the stream selectors, but letting interpolation of the current variable state work its magic
      fieldExpressionToAdd = `| ${streamSelectorName} != ""`;
    }
  }

  const fields = fieldsVariable.state.filters;
  const levels = levelsVariables.state.filters;

  // console.log('fields', fields)
  // console.log('levels', levels)
  // console.log('fieldExpressionToAdd', fieldExpressionToAdd, excludeEmpty)

  // if we have fields, we also need to add `VAR_LOGS_FORMAT_EXPR`
  // /* ${VAR_LEVELS_EXPR} */
  if (fields.length || levels.length) {
    return `sum(count_over_time(${VAR_LABELS_EXPR} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${streamSelectorName})`;
  }
  return `sum(count_over_time(${VAR_LABELS_EXPR} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} [$__auto])) by (${streamSelectorName})`;
}
