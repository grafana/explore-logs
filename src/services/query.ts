import { AdHocVariableFilter, SelectableValue } from '@grafana/data';
import { AppliedPattern } from 'Components/IndexScene/IndexScene';
import {
  AdHocFiltersWithLabelsAndMeta,
  EMPTY_VARIABLE_VALUE,
  FieldValue,
  LEVEL_VARIABLE_VALUE,
  VAR_DATASOURCE_EXPR,
} from './variables';
import { groupBy, trim } from 'lodash';
import { getValueFromFieldsFilter } from './variableGetters';
import { LokiQuery } from './lokiQuery';
import { SceneDataQueryResourceRequest, SceneDataQueryResourceRequestOptions } from './datasourceTypes';
import { PLUGIN_ID } from './plugin';
import { AdHocFiltersVariable, AdHocFilterWithLabels, sceneUtils } from '@grafana/scenes';
import { FilterOp, LineFilterCaseSensitive, LineFilterOp } from './filterTypes';
import { sortLineFilters } from '../Components/IndexScene/LineFilterVariablesScene';
import { isOperatorExclusive, isOperatorInclusive, isOperatorRegex, numericOperatorArray } from './operators';

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
  const positive = filters.filter((filter) => isOperatorInclusive(filter.operator));
  const negative = filters.filter((filter) => isOperatorExclusive(filter.operator));

  const positiveGroups = groupBy(positive, (filter) => filter.key);
  const negativeGroups = groupBy(negative, (filter) => filter.key);

  // Need to break out by operation?
  console.log('labelGroups', {
    positiveGroups,
    negativeGroups,
  });

  return { positiveGroups, negativeGroups };
}

export function getLogQLLabelFilters(filters: AdHocVariableFilter[]) {
  const { positiveGroups, negativeGroups } = getLogQLLabelGroups(filters);

  let positiveFilters: string[] = [];
  for (const key in positiveGroups) {
    const values = positiveGroups[key].map((filter) => filter.value);
    positiveFilters.push(
      values.length === 1
        ? labelFilterToLogQL(positiveGroups[key][0])
        : labelFiltersToLogQL(key, values, FilterOp.RegexEqual)
    );
  }

  let negativeFilters: string[] = [];
  for (const key in negativeGroups) {
    const values = negativeGroups[key].map((filter) => filter.value);
    negativeFilters.push(
      values.length === 1
        ? labelFilterToLogQL(negativeGroups[key][0])
        : labelFiltersToLogQL(key, values, FilterOp.RegexNotEqual)
    );
  }

  return { positiveFilters, negativeFilters };
}

export function renderLogQLLabelFilters(filters: AdHocFilterWithLabels[]) {
  let { positiveFilters, negativeFilters } = getLogQLLabelFilters(filters);

  const result = trim(`${positiveFilters.join(', ')}, ${negativeFilters.join(', ')}`, ' ,');

  return result;
}

export function onAddCustomValue(
  item: SelectableValue<string> & { isCustom?: boolean },
  filter: AdHocFiltersWithLabelsAndMeta
): { value: string | undefined; valueLabels: string[] } {
  const field: FieldValue = {
    value: item.value ?? '',
    parser: filter?.meta?.parser ?? 'mixed',
  };
  return {
    value: JSON.stringify(field),
    valueLabels: [item.label ?? field.value],
  };
}

export function renderLevelsFilter(filters: AdHocVariableFilter[]) {
  if (filters.length) {
    return `| ${LEVEL_VARIABLE_VALUE}=~\`${filters.map((f) => f.value).join('|')}\``;
  }
  return '';
}

export function renderLogQLMetadataFilters(filters: AdHocVariableFilter[]) {
  const positive = filters.filter((filter) => isOperatorInclusive(filter.operator));
  const negative = filters.filter((filter) => isOperatorExclusive(filter.operator));

  const positiveGroups = groupBy(positive, (filter) => filter.key);

  let positiveFilters = '';
  for (const key in positiveGroups) {
    positiveFilters += ' | ' + positiveGroups[key].map((filter) => `${labelFilterToLogQL(filter)}`).join(' or ');
  }

  const negativeFilters = negative.map((filter) => `| ${labelFilterToLogQL(filter)}`).join(' ');

  return `${positiveFilters} ${negativeFilters}`.trim();
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  // @todo partition instead of looping through again and again
  const positive = filters.filter((filter) => isOperatorInclusive(filter.operator));
  const negative = filters.filter((filter) => isOperatorExclusive(filter.operator));

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

export function escapeDoubleQuotedLineFilter(filter: AdHocFilterWithLabels) {
  // Is not regex
  if (filter.operator === LineFilterOp.match || filter.operator === LineFilterOp.negativeMatch) {
    if (filter.key === LineFilterCaseSensitive.caseInsensitive) {
      return sceneUtils.escapeLabelValueInRegexSelector(filter.value);
    } else {
      return sceneUtils.escapeLabelValueInExactSelector(filter.value);
    }
  } else {
    return sceneUtils.escapeLabelValueInExactSelector(filter.value);
  }
}

function buildLogQlLineFilter(filter: AdHocFilterWithLabels, value: string) {
  // Change operator if needed and insert caseInsensitive flag
  if (filter.key === LineFilterCaseSensitive.caseInsensitive) {
    if (filter.operator === LineFilterOp.negativeRegex || filter.operator === LineFilterOp.negativeMatch) {
      return `${LineFilterOp.negativeRegex} "(?i)${value}"`;
    }
    return `${LineFilterOp.regex} "(?i)${value}"`;
  }

  return `${filter.operator} "${value}"`;
}

/**
 * Converts line filter ad-hoc filters to LogQL
 *
 * the filter key is LineFilterCaseSensitive
 * the filter operator is LineFilterOp
 * the value is the user input
 */
export function renderLogQLLineFilter(filters: AdHocFilterWithLabels[]) {
  sortLineFilters(filters);
  return filters
    .map((filter) => {
      if (filter.value === '') {
        return '';
      }

      const value = escapeDoubleQuotedLineFilter(filter);
      return buildLogQlLineFilter(filter, value);
    })
    .join(' ');
}

function labelFilterToLogQL(filter: AdHocVariableFilter) {
  // If the filter value is an empty string, we don't want to wrap it in backticks!
  if (filter.value === EMPTY_VARIABLE_VALUE) {
    return `${filter.key}${filter.operator}${filter.value}`;
  }
  console.log('labelFilterToLogQL', {
    filter,
    output: `${filter.key}${filter.operator}"${sceneUtils.escapeLabelValueInExactSelector(filter.value)}"`,
  });
  if (isOperatorRegex(filter.operator)) {
    return `${filter.key}${filter.operator}"${sceneUtils.escapeLabelValueInRegexSelector(filter.value)}"`;
  }
  return `${filter.key}${filter.operator}"${sceneUtils.escapeLabelValueInExactSelector(filter.value)}"`;
}

function fieldFilterToQueryString(filter: AdHocVariableFilter) {
  const fieldObject = getValueFromFieldsFilter(filter);
  const value = fieldObject.value;
  // If the filter value is an empty string, we don't want to wrap it in quotes!
  if (value === EMPTY_VARIABLE_VALUE) {
    return `${filter.key}${filter.operator}${value}`;
  }
  return `${filter.key}${filter.operator}"${sceneUtils.escapeLabelValueInExactSelector(value)}"`;
}

function fieldNumericFilterToQueryString(filter: AdHocVariableFilter) {
  const fieldObject = getValueFromFieldsFilter(filter);
  const value = fieldObject.value;
  // If the filter value is an empty string, we don't want to wrap it in backticks!

  return `${filter.key}${filter.operator}${value}`;
}

export function labelFiltersToLogQL(key: string, values: string[], operator: FilterOp) {
  const mappedValues = values.map((value) => sceneUtils.escapeLabelValueInRegexSelector(value)).join('|');
  console.log('labelFiltersToLogQL', {
    values,
    mappedValues,
  });
  return `${key}${operator}"${mappedValues}"`;
}

export function renderPatternFilters(patterns: AppliedPattern[]) {
  const excludePatterns = patterns.filter((pattern) => pattern.type === 'exclude');
  const excludePatternsLine = excludePatterns
    .map((p) => `!> "${sceneUtils.escapeLabelValueInExactSelector(p.pattern)}"`)
    .join(' ')
    .trim();

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  let includePatternsLine = '';
  if (includePatterns.length > 0) {
    if (includePatterns.length === 1) {
      includePatternsLine = `|> "${sceneUtils.escapeLabelValueInExactSelector(includePatterns[0].pattern)}"`;
    } else {
      includePatternsLine = `|> ${includePatterns
        .map((p) => `"${sceneUtils.escapeLabelValueInExactSelector(p.pattern)}"`)
        .join(' or ')}`;
    }
  }
  return `${excludePatternsLine} ${includePatternsLine}`.trim();
}

/**
 * Escapes values and joins ad hoc variable filters for consumption by tagKeys, tagValues
 * Do not save the output to state!
 * @param variable
 */
export function joinTagFilters(variable: AdHocFiltersVariable) {
  console.log('join tag filters', variable.state.filters);
  const { positiveGroups, negativeGroups } = getLogQLLabelGroups(variable.state.filters);

  const filters: AdHocFilterWithLabels[] = [];
  // @todo DRY
  for (const key in positiveGroups) {
    const matchValues = positiveGroups[key]
      .filter((filter) => filter.operator === FilterOp.Equal)
      .map((filter) => filter.value);
    const regexValues = positiveGroups[key]
      .filter((filter) => filter.operator === FilterOp.RegexEqual)
      .map((filter) => filter.value);

    if (matchValues.length) {
      if (matchValues.length === 1) {
        filters.push({
          key,
          value: sceneUtils.escapeLabelValueInExactSelector(positiveGroups[key][0].value),
          operator: positiveGroups[key][0].operator,
        });
      } else {
        filters.push({
          key,
          value: matchValues.map((value) => sceneUtils.escapeLabelValueInRegexSelector(value)).join('|'),
          operator: '=~',
        });
      }
    }

    if (regexValues.length) {
      filters.push({
        key,
        value: regexValues.map((value) => sceneUtils.escapeLabelValueInRegexSelector(value)).join('|'),
        operator: '=~',
      });
    }
  }

  for (const key in negativeGroups) {
    const matchValues = positiveGroups[key]
      .filter((filter) => filter.operator === FilterOp.Equal)
      .map((filter) => filter.value);
    const regexValues = positiveGroups[key]
      .filter((filter) => filter.operator === FilterOp.RegexEqual)
      .map((filter) => filter.value);

    if (matchValues.length) {
      if (matchValues.length === 1) {
        filters.push({
          key,
          value: sceneUtils.escapeLabelValueInExactSelector(positiveGroups[key][0].value),
          operator: negativeGroups[key][0].operator,
        });
      } else {
        filters.push({
          key,
          value: matchValues.map((value) => sceneUtils.escapeLabelValueInRegexSelector(value)).join('|'),
          operator: '!~',
        });
      }
    }

    if (regexValues.length) {
      filters.push({
        key,
        value: regexValues.map((value) => sceneUtils.escapeLabelValueInRegexSelector(value)).join('|'),
        operator: '=~',
      });
    }
  }

  return filters;
}
export function wrapWildcardSearch(input: string) {
  if (input === '.+') {
    return input;
  } else if (input.substring(0, 6) !== '(?i).*') {
    return `(?i).*${input}.*`;
  }

  return input;
}

export function unwrapWildcardSearch(input: string) {
  if (input.substring(0, 6) === '(?i).*' && input.slice(-2) === '.*') {
    return input.slice(6).slice(0, -2);
  }

  return input;
}

export function sanitizeStreamSelector(expression: string) {
  return expression.replace(/\s*,\s*}/, '}');
}

// default line limit; each data source can define it's own line limit too
export const LINE_LIMIT = 1000;
