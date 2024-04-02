/**
 * Imported types from Grafana core. Required to access typed access to the Loki data source API.
 * Do not add or modify types.
 */
import { Observable } from 'rxjs';

import {
  AbstractQuery,
  AdHocVariableFilter,
  AnnotationEvent,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceWithLogsContextSupport,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
  DataSourceWithQueryModificationSupport,
  DataSourceWithSupplementaryQueriesSupport,
  DataSourceWithToggleableQueryFiltersSupport,
  LanguageProvider,
  LegacyMetricFindQueryOptions,
  LogRowContextOptions,
  LogRowModel,
  QueryFilterOptions,
  QueryFixAction,
  QueryHint,
  ScopedVars,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
  TimeRange,
  ToggleFilterAction,
} from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

export interface ParserAndLabelKeysResult {
  extractedLabelKeys: string[];
  structuredMetadataKeys: string[];
  hasJSON: boolean;
  hasLogfmt: boolean;
  hasPack: boolean;
  unwrapLabelKeys: string[];
}

export type LabelsResponse = {
  status: string;
  data: string[];
};

export interface LokiLanguageProvider extends LanguageProvider {
  request(url: string, params?: any): Promise<LabelsResponse>;
  start(timeRange?: TimeRange): Promise<any[]>;
  getLabelKeys(): string[];
  importFromAbstractQuery(labelBasedQuery: AbstractQuery): LokiQuery;
  exportToAbstractQuery(query: LokiQuery): AbstractQuery;
  fetchLabels(options?: { timeRange?: TimeRange }): Promise<string[]>;
  fetchSeriesLabels(streamSelector: string, options?: { timeRange?: TimeRange }): Promise<Record<string, string[]>>;
  fetchSeries(match: string, options?: { timeRange?: TimeRange }): Promise<Array<Record<string, string>>>;
  fetchLabelValues(labelName: string, options?: { streamSelector?: string; timeRange?: TimeRange }): Promise<string[]>;
  getParserAndLabelKeys(
    streamSelector: string,
    options?: { maxLines?: number; timeRange?: TimeRange }
  ): Promise<ParserAndLabelKeysResult>;
}

interface LokiQueryFromSchema extends DataQuery {
  expr: string;
  instant?: boolean;
  legendFormat?: string;
  maxLines?: number;
  range?: boolean;
  resolution?: number;
  step?: string;
}

export enum LokiQueryDirection {
  Backward = 'backward',
  Forward = 'forward',
}

enum SupportingQueryType {
  DataSample = 'dataSample',
  InfiniteScroll = 'infiniteScroll',
  LogsSample = 'logsSample',
  LogsVolume = 'logsVolume',
}

export enum LokiQueryType {
  Instant = 'instant',
  Range = 'range',
  Stream = 'stream',
}

export type DerivedFieldConfig = {
  matcherRegex: string;
  name: string;
  url?: string;
  urlDisplayLabel?: string;
  datasourceUid?: string;
  matcherType?: 'label' | 'regex';
};

interface LokiOptions extends DataSourceJsonData {
  maxLines?: string;
  derivedFields?: DerivedFieldConfig[];
  alertmanager?: string;
  keepCookies?: string[];
  predefinedOperations?: string;
}

interface MetricFindValue {
  text: string;
  value?: string | number;
  expandable?: boolean;
}

enum LokiVariableQueryType {
  LabelNames,
  LabelValues,
}

interface LokiVariableQuery extends DataQuery {
  type: LokiVariableQueryType;
  label?: string;
  stream?: string;
}

export interface QueryStats {
  streams: number;
  chunks: number;
  bytes: number;
  entries: number;
  message?: string;
}

export interface LokiQuery extends LokiQueryFromSchema {
  direction?: LokiQueryDirection;
  supportingQueryType?: SupportingQueryType;
  queryType?: LokiQueryType;
  splitDuration?: string;
}
//@ts-ignore
export interface LokiDatasource
  extends DataSourceWithBackend<LokiQuery, LokiOptions>,
    DataSourceWithLogsContextSupport,
    DataSourceWithSupplementaryQueriesSupport<LokiQuery>,
    DataSourceWithQueryImportSupport<LokiQuery>,
    DataSourceWithQueryExportSupport<LokiQuery>,
    DataSourceWithToggleableQueryFiltersSupport<LokiQuery>,
    DataSourceWithQueryModificationSupport<LokiQuery> {
  languageProvider: LokiLanguageProvider;
  instanceSettings: DataSourceInstanceSettings<LokiOptions>;
  getSupplementaryRequest(
    type: SupplementaryQueryType,
    request: DataQueryRequest<LokiQuery>,
    options?: SupplementaryQueryOptions
  ): DataQueryRequest<LokiQuery> | undefined;
  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[];
  getSupplementaryQuery(options: SupplementaryQueryOptions, query: LokiQuery): LokiQuery | undefined;
  query(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse>;
  interpolateVariablesInQueries(
    queries: LokiQuery[],
    scopedVars: ScopedVars,
    adhocFilters?: AdHocVariableFilter[]
  ): LokiQuery[];
  getQueryDisplayText(query: LokiQuery): string;
  getTimeRangeParams(timeRange: TimeRange): { start: number; end: number };
  importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<LokiQuery[]>;
  exportToAbstractQueries(queries: LokiQuery[]): Promise<AbstractQuery[]>;
  metadataRequest(
    url: string,
    params?: Record<string, string | number>,
    options?: Partial<BackendSrvRequest>
  ): Promise<LabelsResponse>;
  statsMetadataRequest(
    url: string,
    params?: Record<string, string | number>,
    options?: Partial<BackendSrvRequest>
  ): Promise<QueryStats>;
  getQueryStats(query: LokiQuery, timeRange: TimeRange): Promise<QueryStats | undefined>;
  getStatsTimeRange(
    query: LokiQuery,
    idx: number,
    timeRange: TimeRange
  ): { start: number | undefined; end: number | undefined };
  getStats(query: LokiQuery, timeRange: TimeRange): Promise<QueryStats | null>;
  metricFindQuery(
    query: LokiVariableQuery | string,
    options?: LegacyMetricFindQueryOptions
  ): Promise<MetricFindValue[]>;
  getDataSamples(query: LokiQuery, timeRange: TimeRange): Promise<DataFrame[]>;
  getTagKeys(options?: DataSourceGetTagKeysOptions): Promise<MetricFindValue[]>;
  getTagValues(options: DataSourceGetTagValuesOptions): Promise<MetricFindValue[]>;
  interpolateQueryExpr(value: any, variable: any): string;
  toggleQueryFilter(query: LokiQuery, filter: ToggleFilterAction): LokiQuery;
  queryHasFilter(query: LokiQuery, filter: QueryFilterOptions): boolean;
  modifyQuery(query: LokiQuery, action: QueryFixAction): LokiQuery;
  getSupportedQueryModifications(): string[];
  getLogRowContext(
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: DataQuery
  ): Promise<{ data: DataFrame[] }>;
  getLogRowContextQuery(
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: DataQuery,
    cacheFilters?: boolean
  ): Promise<DataQuery>;
  getLogRowContextUi(row: LogRowModel, runContextQuery: () => void, origQuery: DataQuery): React.ReactNode;
  annotationQuery(options: any): Promise<AnnotationEvent[]>;
  addAdHocFilters(queryExpr: string, adhocFilters?: AdHocVariableFilter[]): string;
  filterQuery(query: LokiQuery): boolean;
  applyTemplateVariables(target: LokiQuery, scopedVars: ScopedVars, adhocFilters?: AdHocVariableFilter[]): LokiQuery;
  interpolateString(string: string, scopedVars?: ScopedVars): string;
  getVariables(): string[];
  getQueryHints(query: LokiQuery, result: DataFrame[]): QueryHint[];
  getDefaultQuery(app: CoreApp): LokiQuery;
}
