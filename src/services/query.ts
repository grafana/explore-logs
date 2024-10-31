import {AdHocVariableFilter} from '@grafana/data';
import {AppliedPattern} from 'Components/IndexScene/IndexScene';
import {getPrimaryLabelFromUrl, PLUGIN_ID} from './routing';
import {EMPTY_VARIABLE_VALUE, VAR_DATASOURCE_EXPR} from './variables';
import {FilterOp} from './filters';
import {groupBy, trim} from 'lodash';
import {getValueFromFieldsFilter} from './variableGetters';
import {LokiQuery} from './lokiQuery';
import {SceneDataQueryResourceRequest} from './datasourceTypes';
import {AdHocFilterWithLabels} from "../../../scenes/packages/scenes";

/**
 * Builds the resource query
 * @param expr string to be interpolated and executed in the resource request
 * @param resource
 * @param queryParamsOverrides
 */
export const buildResourceQuery = (
  expr: string,
  resource: 'volume' | 'patterns' | 'detected_labels' | 'detected_fields' | 'labels',
  queryParamsOverrides?: Record<string, unknown>
): LokiQuery & SceneDataQueryResourceRequest => {
  return {
    ...defaultQueryParams,
    resource,
    refId: resource,
    ...queryParamsOverrides,
    datasource: { uid: VAR_DATASOURCE_EXPR },
    expr,
  };
};

export const buildVolumeQuery = (
    expr: string,
    resource: 'volume' | 'patterns' | 'detected_labels' | 'detected_fields' | 'labels',
    primaryLabel: string,
    queryParamsOverrides?: Record<string, unknown>
): LokiQuery & SceneDataQueryResourceRequest => {
  return buildResourceQuery(expr, resource, {...queryParamsOverrides, primaryLabel})
}
/**
 * Builds a loki data query
 * @param expr
 * @param queryParamsOverrides
 * @returns LokiQuery
 */
export const buildDataQuery = (expr: string, queryParamsOverrides?: Record<string, unknown>): LokiQuery => {
  return {
    ...defaultQueryParams,
    ...queryParamsOverrides,
    expr,
  };
};

const defaultQueryParams = {
  refId: 'A',
  queryType: 'range',
  editorMode: 'code',
  supportingQueryType: PLUGIN_ID,
};

export function getLogQLLabelGroups(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const positiveGroups = groupBy(positive, (filter) => filter.key);
  return { negative, positiveGroups };
}

export function getLogQLLabelFilters(filters: AdHocVariableFilter[]) {
  const { negative, positiveGroups } = getLogQLLabelGroups(filters);

  let positiveFilters: string[] = [];
  for (const key in positiveGroups) {
    const values = positiveGroups[key].map((filter) => filter.value);
    positiveFilters.push(
      values.length === 1 ? renderMetadata(positiveGroups[key][0]) : renderRegexLabelFilter(key, values)
    );
  }

  return { positiveFilters, negative };
}

export function renderLogQLLabelFilters(filters: AdHocFilterWithLabels[]) {
  const {labelValue} = getPrimaryLabelFromUrl()

  // @todo remove this, clean up filters after nav
  if(!labelValue){
    filters = filters.filter(f => !f.meta?.excludeFromQuery)
  }

  let { positiveFilters, negative } = getLogQLLabelFilters(filters);
  const negativeFilters = negative.map((filter) => renderMetadata(filter)).join(', ');

  const result = trim(`${positiveFilters.join(', ')}, ${negativeFilters}`, ' ,');
  // console.log('renderLogQLLabelFilters', {result, filters });
  // Since we use this variable after other non-interpolated labels in some queries, and on its own in others, we need to know that this expression can be preceded by a comma, so we output a placeholder value that shouldn't impact the query if the expression is empty, otherwise we'll output invalid logQL
  if(!result){
    return '__placeholder__=""'
  }

  return result;
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters = '';
  for (const key in positiveGroups) {
    positiveFilters += ' | ' + positiveGroups[key].map((filter) => `${fieldFilterToQueryString(filter)}`).join(' or ');
  }

  const negativeFilters = negative.map((filter) => `| ${fieldFilterToQueryString(filter)}`).join(' ');

  return `${positiveFilters} ${negativeFilters}`.trim();
}

export function renderLogQLMetadataFilters(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters = '';
  for (const key in positiveGroups) {
    positiveFilters += ' | ' + positiveGroups[key].map((filter) => `${renderMetadata(filter)}`).join(' or ');
  }

  const negativeFilters = negative.map((filter) => `| ${renderMetadata(filter)}`).join(' ');

  return `${positiveFilters} ${negativeFilters}`.trim();
}

function renderMetadata(filter: AdHocVariableFilter) {
  // If the filter value is an empty string, we don't want to wrap it in backticks!
  if (filter.value === EMPTY_VARIABLE_VALUE) {
    return `${filter.key}${filter.operator}${filter.value}`;
  }
  return `${filter.key}${filter.operator}\`${filter.value}\``;
}

function fieldFilterToQueryString(filter: AdHocVariableFilter) {
  const fieldObject = getValueFromFieldsFilter(filter);
  const value = fieldObject.value;
  // If the filter value is an empty string, we don't want to wrap it in backticks!
  if (value === EMPTY_VARIABLE_VALUE) {
    return `${filter.key}${filter.operator}${value}`;
  }
  return `${filter.key}${filter.operator}\`${value}\``;
}

export function renderRegexLabelFilter(key: string, values: string[]) {
  return `${key}=~"${values.join('|')}"`;
}

export function renderPatternFilters(patterns: AppliedPattern[]) {
  const excludePatterns = patterns.filter((pattern) => pattern.type === 'exclude');
  const excludePatternsLine = excludePatterns
    .map((p) => `!> \`${p.pattern}\``)
    .join(' ')
    .trim();

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  let includePatternsLine = '';
  if (includePatterns.length > 0) {
    if (includePatterns.length === 1) {
      includePatternsLine = `|> \`${includePatterns[0].pattern}\``;
    } else {
      includePatternsLine = `|>  ${includePatterns.map((p) => `\`${p.pattern}\``).join(' or ')}`;
    }
  }
  return `${excludePatternsLine} ${includePatternsLine}`.trim();
}
