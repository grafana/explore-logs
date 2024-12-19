import { AdHocVariableFilter } from '@grafana/data';
import { AppliedPattern, numericOperatorArray } from 'Components/IndexScene/IndexScene';
import { EMPTY_VARIABLE_VALUE, VAR_DATASOURCE_EXPR } from './variables';
import { escapeRegExp, groupBy, trim } from 'lodash';
import { getValueFromFieldsFilter } from './variableGetters';
import { LokiQuery } from './lokiQuery';
import { SceneDataQueryResourceRequest, SceneDataQueryResourceRequestOptions } from './datasourceTypes';
import { AdHocFilterWithLabels } from './scenes';
import { PLUGIN_ID } from './plugin';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { FilterOp, LineFilterOp } from './filterTypes';
import { LineFilterCaseSensitive } from '../Components/ServiceScene/LineFilterScene';

/**
 * Builds the resource query
 * @param expr string to be interpolated and executed in the resource request
 * @param resource
 * @param queryParamsOverrides
 * @param primaryLabel
 */
export const buildResourceQuery = (
  expr: string,
  resource: SceneDataQueryResourceRequestOptions,
  queryParamsOverrides?: Partial<LokiQuery>,
  primaryLabel?: string
): LokiQuery & SceneDataQueryResourceRequest & { primaryLabel?: string } => {
  return {
    ...defaultQueryParams,
    resource,
    refId: resource,
    ...queryParamsOverrides,
    datasource: { uid: VAR_DATASOURCE_EXPR },
    expr,
    primaryLabel,
  };
};
/**
 * Builds a loki data query
 * @param expr
 * @param queryParamsOverrides
 * @returns LokiQuery
 */
export const buildDataQuery = (expr: string, queryParamsOverrides?: Partial<LokiQuery>): LokiQuery => {
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

export const buildVolumeQuery = (
  expr: string,
  resource: 'volume' | 'patterns' | 'detected_labels' | 'detected_fields' | 'labels',
  primaryLabel: string,
  queryParamsOverrides?: Record<string, unknown>
): LokiQuery & SceneDataQueryResourceRequest => {
  return buildResourceQuery(expr, resource, { ...queryParamsOverrides }, primaryLabel);
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
  let { positiveFilters, negative } = getLogQLLabelFilters(filters);
  const negativeFilters = negative.map((filter) => renderMetadata(filter)).join(', ');

  const result = trim(`${positiveFilters.join(', ')}, ${negativeFilters}`, ' ,');

  return result;
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  // @todo partition instead of looping through again and again
  const positive = filters.filter((filter) => filter.operator === FilterOp.Equal);
  const negative = filters.filter((filter) => filter.operator === FilterOp.NotEqual);

  const numeric = filters.filter((filter) => {
    const numericValues: string[] = numericOperatorArray;
    return numericValues.includes(filter.operator);
  });

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters = '';
  for (const key in positiveGroups) {
    positiveFilters += ' | ' + positiveGroups[key].map((filter) => `${fieldFilterToQueryString(filter)}`).join(' or ');
  }

  const negativeFilters = negative.map((filter) => `| ${fieldFilterToQueryString(filter)}`).join(' ');

  let numericFilters = numeric.map((filter) => `| ${fieldNumericFilterToQueryString(filter)}`).join(' ');

  return `${positiveFilters} ${negativeFilters} ${numericFilters}`.trim();
}

/**
 * Converts line filter ad-hoc filters to LogQL
 *
 * the filter key is LineFilterCaseSensitive
 * the filter operator is LineFilterOp
 * the value is the user in put
 */
export function renderLogQLLineFilter(filters: AdHocFilterWithLabels[]) {
  //@todo DRY
  filters.sort((a, b) => parseInt(a.keyLabel ?? '0', 10) - parseInt(b.keyLabel ?? '0', 10));
  return filters
    .map((f) => {
      if (f.value === '') {
        return '';
      }
      const value =
        (f.operator === LineFilterOp.match || f.operator === LineFilterOp.negativeMatch) &&
        f.key === LineFilterCaseSensitive.caseInsensitive
          ? escapeRegExp(f.value)
          : f.value;

      if (f.key === LineFilterCaseSensitive.caseInsensitive) {
        if (f.operator === LineFilterOp.negativeRegex || f.operator === LineFilterOp.negativeMatch) {
          return `${LineFilterOp.negativeRegex} \`(?i)${value}\``;
        }
        return `${LineFilterOp.regex} \`(?i)${value}\``;
      }

      return `${f.operator} \`${value}\``;
    })
    .join(' ');
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

function fieldNumericFilterToQueryString(filter: AdHocVariableFilter) {
  const fieldObject = getValueFromFieldsFilter(filter);
  const value = fieldObject.value;
  // If the filter value is an empty string, we don't want to wrap it in backticks!

  return `${filter.key}${filter.operator}${value}`;
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

export function joinTagFilters(variable: AdHocFiltersVariable) {
  const { positiveGroups, negative } = getLogQLLabelGroups(variable.state.filters);

  const filters: AdHocFilterWithLabels[] = [];
  for (const key in positiveGroups) {
    const values = positiveGroups[key].map((filter) => filter.value);
    if (values.length === 1) {
      filters.push({
        key,
        value: positiveGroups[key][0].value,
        operator: '=',
      });
    } else {
      filters.push({
        key,
        value: values.join('|'),
        operator: '=~',
      });
    }
  }

  negative.forEach((filter) => {
    filters.push(filter);
  });
  return filters;
}

export function wrapWildcardSearch(input: string) {
  if (input !== '.+' && input.substring(0, 2) !== '.*') {
    return `.*${input}.*`;
  }

  return input;
}

export function unwrapWildcardSearch(input: string) {
  if (input.substring(0, 2) === '.*' && input.slice(-2) === '.*') {
    return input.slice(2).slice(0, -2);
  }
  return input;
}

export function sanitizeStreamSelector(expression: string) {
  return expression.replace(/\s*,\s*}/, '}');
}

// default line limit; each data source can define it's own line limit too
export const LINE_LIMIT = 1000;
