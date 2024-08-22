import { AdHocVariableFilter } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { AppliedPattern } from 'Components/IndexScene/IndexScene';
import { PLUGIN_ID } from './routing';
import { SceneDataQueryResourceRequest } from './datasource';
import { VAR_DATASOURCE_EXPR } from './variables';

export type LokiQuery = {
  refId: string;
  queryType: string;
  editorMode: string;
  supportingQueryType: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;
  datasource?: DataSourceRef;
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

export function joinFilters(filters: AdHocVariableFilter[]) {
  return filters.map((filter) => renderFilter(filter)).join(', ');
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  return filters.map((filter) => `| ${renderFilter(filter)}`).join(' ');
}

function renderFilter(filter: AdHocVariableFilter) {
  if (filter.value === '""') {
    return `${filter.key}${filter.operator}${filter.value}`;
  }
  return `${filter.key}${filter.operator}\`${filter.value}\``;
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
