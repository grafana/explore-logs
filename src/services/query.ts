import { AdHocVariableFilter } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { AppliedPattern } from 'Components/IndexScene/IndexScene';
import { PLUGIN_ID } from './routing';
import { SceneDataQueryResourceRequest } from './datasource';
import { EMPTY_VARIABLE_VALUE, VAR_DATASOURCE_EXPR } from './variables';
import { FilterOp } from './filters';
import { groupBy, trim } from 'lodash';

export type LokiQuery = {
  refId: string;
  queryType: string;
  editorMode: string;
  supportingQueryType: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;
  datasource?: DataSourceRef;
  maxLines?: number;
};

/**
 * Builds the resource query
 * @param expr string to be interpolated and executed in the resource request
 * @param resource
 * @param queryParamsOverrides
 */
export const buildResourceQuery = (
  expr: string,
  resource: 'volume' | 'patterns' | 'detected_labels',
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

export function renderLogQLLabelFilters(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters: string[] = [];
  for (const key in positiveGroups) {
    const values = positiveGroups[key].map((filter) => filter.value);
    positiveFilters.push(
      values.length === 1 ? renderFilter(positiveGroups[key][0]) : renderRegexLabelFilter(key, values)
    );
  }

  const negativeFilters = negative.map((filter) => renderFilter(filter)).join(', ');

  return trim(`${positiveFilters.join(', ')}, ${negativeFilters}`, ' ,');
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters = '';
  for (const key in positiveGroups) {
    positiveFilters += ' | ' + positiveGroups[key].map((filter) => `${renderFilter(filter)}`).join(' or ');
  }

  const negativeFilters = negative.map((filter) => `| ${renderFilter(filter)}`).join(' ');

  return `${positiveFilters} ${negativeFilters}`.trim();
}

function renderFilter(filter: AdHocVariableFilter) {
  // If the filter value is an empty string, we don't want to wrap it in backticks!
  if (filter.value === EMPTY_VARIABLE_VALUE) {
    return `${filter.key}${filter.operator}${filter.value}`;
  }
  return `${filter.key}${filter.operator}\`${filter.value}\``;
}

function renderRegexLabelFilter(key: string, values: string[]) {
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
