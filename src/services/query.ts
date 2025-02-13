import { AdHocVariableFilter, SelectableValue } from '@grafana/data';
import { AppliedPattern } from 'Components/IndexScene/IndexScene';
import {
  addAdHocFilterUserInputPrefix,
  AdHocFiltersWithLabelsAndMeta,
  FieldValue,
  VAR_DATASOURCE_EXPR,
} from './variables';
import { LokiQuery } from './lokiQuery';
import { SceneDataQueryResourceRequest, SceneDataQueryResourceRequestOptions } from './datasourceTypes';
import { PLUGIN_ID } from './plugin';
import { AdHocFilterWithLabels, sceneUtils } from '@grafana/scenes';
import { LineFilterCaseSensitive, LineFilterOp } from './filterTypes';
import { sortLineFilters } from '../Components/IndexScene/LineFilterVariablesScene';
import { ExpressionBuilder } from './ExpressionBuilder';

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

export function renderLogQLLabelFilters(filters: AdHocFilterWithLabels[], ignoreKeys?: string[]) {
  const filtersTransformer = new ExpressionBuilder(filters);
  return filtersTransformer.getLabelsExpr({ ignoreKeys });
}

export function onAddCustomAdHocValue(item: SelectableValue<string>): {
  value: string | undefined;
  valueLabels: string[];
} {
  if (item.value) {
    return {
      value: addAdHocFilterUserInputPrefix(item.value),
      valueLabels: [item.label ?? item.value],
    };
  }

  return {
    value: item.value,
    valueLabels: [item.label ?? item.value ?? ''],
  };
}

export function onAddCustomFieldValue(
  item: SelectableValue<string> & { isCustom?: boolean },
  filter: AdHocFiltersWithLabelsAndMeta
): { value: string | undefined; valueLabels: string[] } {
  const field: FieldValue = {
    value: item.value ?? '',
    parser: filter?.meta?.parser ?? 'mixed',
  };

  // metadata is not encoded
  if (field.parser === 'structuredMetadata') {
    return {
      value: addAdHocFilterUserInputPrefix(field.value),
      valueLabels: [item.label ?? field.value],
    };
  }

  return {
    value: addAdHocFilterUserInputPrefix(JSON.stringify(field)),
    valueLabels: [item.label ?? field.value],
  };
}

export function renderLevelsFilter(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getLevelsExpr({ ignoreKeys });
}

export function renderLogQLMetadataFilters(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getMetadataExpr({ ignoreKeys });
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[], ignoreKeys?: string[]) {
  const filterTransformer = new ExpressionBuilder(filters);
  return filterTransformer.getFieldsExpr({ ignoreKeys });
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

/**
 * Builds line filter as a double-quoted LogQL string
 * Expects pre-escaped values
 */
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

// @todo worth migrating into the ExpressionBuilder class?
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
