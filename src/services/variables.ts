// Warning, this file is included in the main module.tsx bundle, and doesn't contain any imports to keep that bundle size small. Don't add imports to this file!

import { AdHocFilterWithLabels } from '@grafana/scenes';

export interface FieldValue {
  value: string;
  parser: ParserType;
}

export interface AdHocFieldValue {
  value?: string;
  parser?: ParserType;
}
export interface AppliedPattern {
  pattern: string;
  type: 'include' | 'exclude';
}

export type ParserType = 'logfmt' | 'json' | 'mixed' | 'structuredMetadata';
export type DetectedFieldType = 'int' | 'float' | 'duration' | 'bytes' | 'boolean' | 'string';
export type AdHocFilterWithLabelsMeta = { parser?: ParserType; type?: DetectedFieldType };
export type AdHocFiltersWithLabelsAndMeta = AdHocFilterWithLabels<AdHocFilterWithLabelsMeta>;

export type LogsQueryOptions = {
  labelExpressionToAdd?: string;
  structuredMetadataToAdd?: string;
  fieldExpressionToAdd?: string;
  parser?: ParserType;
  fieldType?: DetectedFieldType;
};

export const VAR_LABELS = 'filters';
export const VAR_LABELS_EXPR = '${filters}';
export const VAR_LABELS_REPLICA = 'filters_replica';
export const VAR_LABELS_REPLICA_EXPR = '${filters_replica}';
export const VAR_FIELDS = 'fields';
export const VAR_FIELDS_EXPR = '${fields}';
export const PENDING_FIELDS_EXPR = '${pendingFields}';
export const PENDING_METADATA_EXPR = '${pendingMetadata}';
export const VAR_FIELDS_AND_METADATA = 'all-fields';
export const VAR_METADATA = 'metadata';
export const VAR_METADATA_EXPR = '${metadata}';
export const VAR_PATTERNS = 'patterns';
export const VAR_PATTERNS_EXPR = '${patterns}';
export const VAR_LEVELS = 'levels';
export const VAR_LEVELS_EXPR = '${levels}';
export const VAR_FIELD_GROUP_BY = 'fieldBy';
export const VAR_LABEL_GROUP_BY = 'labelBy';
export const VAR_LABEL_GROUP_BY_EXPR = '${labelBy}';
export const VAR_PRIMARY_LABEL_SEARCH = 'primary_label_search';
export const VAR_PRIMARY_LABEL_SEARCH_EXPR = '${primary_label_search}';
export const VAR_PRIMARY_LABEL = 'primary_label';
export const VAR_PRIMARY_LABEL_EXPR = '${primary_label}';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const MIXED_FORMAT_EXPR = `| json | logfmt | drop __error__, __error_details__`;
export const JSON_FORMAT_EXPR = `| json | drop __error__, __error_details__`;
export const LOGS_FORMAT_EXPR = `| logfmt`;
// This variable is hardcoded to the value of MIXED_FORMAT_EXPR. This is a hack to get logs context working, we don't want to use a variable for a value that doesn't change and cannot be updated by the user.
export const VAR_LOGS_FORMAT = 'logsFormat';
export const VAR_LOGS_FORMAT_EXPR = '${logsFormat}';
// The deprecated line filter (custom variable)
export const VAR_LINE_FILTER_DEPRECATED = 'lineFilter';
// The new single value line filter (ad-hoc variable), results are added to VAR_LINE_FILTER_AD_HOC when "submitted"
export const VAR_LINE_FILTER = 'lineFilterV2';
export const VAR_LINE_FILTER_EXPR = '${lineFilterV2}';
// The new multi value line filter (ad-hoc variable)
export const VAR_LINE_FILTERS = 'lineFilters';
export const VAR_LINE_FILTERS_EXPR = '${lineFilters}';
export const LOG_STREAM_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR}`;
// Same as the LOG_STREAM_SELECTOR_EXPR, but without the fields as they will need to be built manually to exclude the current filter value
export const DETECTED_FIELD_VALUES_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${PENDING_FIELDS_EXPR}`;
export const DETECTED_FIELD_AND_METADATA_VALUES_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_LEVELS_EXPR} ${PENDING_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${PENDING_FIELDS_EXPR}`;
export const DETECTED_METADATA_VALUES_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_LEVELS_EXPR} ${PENDING_FIELDS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR}`;
export const DETECTED_LEVELS_VALUES_EXPR = `{${VAR_LABELS_EXPR}} ${PENDING_FIELDS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR}`;
export const PATTERNS_SAMPLE_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR}`;
export const PRETTY_LOG_STREAM_SELECTOR_EXPR = `${VAR_LABELS_EXPR} ${VAR_LEVELS_EXPR} ${VAR_METADATA_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTERS_EXPR} ${VAR_FIELDS_EXPR}`;
export const EXPLORATION_DS = { uid: VAR_DATASOURCE_EXPR };
export const ALL_VARIABLE_VALUE = '$__all';
export const LEVEL_VARIABLE_VALUE = 'detected_level';
export const SERVICE_NAME = 'service_name';
export const SERVICE_UI_LABEL = 'service';
export const VAR_AGGREGATED_METRICS = 'var_aggregated_metrics';
export const VAR_AGGREGATED_METRICS_EXPR = '${var_aggregated_metrics}';
export const EMPTY_VARIABLE_VALUE = '""';

// Delimiter used at the start of a label value to denote user input that should not be escaped
// @todo we need ad-hoc-filter meta that is persisted in the URL so we can clean this up.
export const USER_INPUT_ADHOC_VALUE_PREFIX = '__CVΩ__';
export function stripAdHocFilterUserInputPrefix(value = '') {
  if (value.startsWith(USER_INPUT_ADHOC_VALUE_PREFIX)) {
    return value.substring(USER_INPUT_ADHOC_VALUE_PREFIX.length);
  }
  return value;
}
export function isAdHocFilterValueUserInput(value = '') {
  return value.startsWith(USER_INPUT_ADHOC_VALUE_PREFIX);
}
export function addAdHocFilterUserInputPrefix(value = '') {
  return USER_INPUT_ADHOC_VALUE_PREFIX + value;
}
