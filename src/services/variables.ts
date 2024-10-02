// Warning, this file is included in the main module.tsx bundle, and doesn't contain any imports to keep that bundle size small. Don't add imports to this file!

export interface FieldValue {
  value: string;
  parser: ParserType;
}

export interface AdHocFieldValue {
  value?: string;
  parser?: ParserType;
}

export type ParserType = 'logfmt' | 'json' | 'mixed' | 'structuredMetadata';

export type LogsQueryOptions = {
  labelExpressionToAdd?: string;
  structuredMetadataToAdd?: string;
  fieldExpressionToAdd?: string;
  parser?: ParserType;
};

export const VAR_LABELS = 'filters';
export const VAR_LABELS_EXPR = '${filters}';
export const VAR_FIELDS = 'fields';
export const VAR_FIELDS_EXPR = '${fields}';
export const VAR_PATTERNS = 'patterns';
export const VAR_PATTERNS_EXPR = '${patterns}';
export const VAR_LEVELS = 'levels';
export const VAR_LEVELS_EXPR = '${levels}';
export const VAR_FIELD_GROUP_BY = 'fieldBy';
export const VAR_LABEL_GROUP_BY = 'labelBy';
export const VAR_LABEL_GROUP_BY_EXPR = '${labelBy}';
export const VAR_PRIMARY_LABEL_SEARCH = 'primary_label_search';
export const VAR_PRIMARY_LABEL_SEARCH_EXPR = '${primary_label_search}';
export const VAR_PRIMARY_LABEL = 'primary_label'
export const VAR_PRIMARY_LABEL_EXPR = '${primary_label}'
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const MIXED_FORMAT_EXPR = `| json | logfmt | drop __error__, __error_details__`;
export const JSON_FORMAT_EXPR = `| json | drop __error__, __error_details__`;
export const LOGS_FORMAT_EXPR = `| logfmt`;
// This variable is hardcoded to the value of MIXED_FORMAT_EXPR. This is a hack to get logs context working, we don't want to use a variable for a value that doesn't change and cannot be updated by the user.
export const VAR_LOGS_FORMAT = 'logsFormat';
export const VAR_LOGS_FORMAT_EXPR = '${logsFormat}';
export const VAR_LINE_FILTER = 'lineFilter';
export const VAR_LINE_FILTER_EXPR = '${lineFilter}';
export const LOG_STREAM_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_PATTERNS_EXPR} ${VAR_LINE_FILTER_EXPR} ${VAR_LEVELS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR}`;
export const PATTERNS_SAMPLE_SELECTOR_EXPR = `{${VAR_LABELS_EXPR}} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR}`;
export const EXPLORATION_DS = { uid: VAR_DATASOURCE_EXPR };
export const ALL_VARIABLE_VALUE = '$__all';
export const LEVEL_VARIABLE_VALUE = 'detected_level';
export const SERVICE_NAME = 'service_name';
export const SERVICE_UI_LABEL = 'service'
export const SERVICE_LABEL_VAR = 'service_label_var';
export const SERVICE_LABEL_EXPR = '${service_label_var}';
export const EMPTY_VARIABLE_VALUE = '""';
