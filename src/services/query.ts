import { AdHocVariableFilter, DataSourceApi } from '@grafana/data';
import { AppliedPattern } from 'Components/IndexScene/IndexScene';
import { PLUGIN_ID } from './routing';
import { SceneDataQueryResourceRequest } from './datasource';

export type LokiQuery = {
  refId: string;
  queryType: string;
  editorMode: string;
  supportingQueryType: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;

  datasource?: DataSourceApi;
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
    ...queryParamsOverrides,
    expr,
  };
};
export const buildLokiQuery = (expr: string, queryParamsOverrides?: Record<string, unknown>): LokiQuery => {
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

export function renderLogQLStreamSelector(filters: AdHocVariableFilter[]) {
  return '{' + filters.map((filter) => renderFilter(filter)).join(', ') + '}';
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  return filters.map((filter) => `| ${renderFilter(filter)}`).join(' ');
}

function renderFilter(filter: AdHocVariableFilter) {
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
