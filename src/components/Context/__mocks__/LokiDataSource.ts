import { of } from 'rxjs';

import {
  AbstractQuery,
  DataQueryRequest,
  DataSourceInstanceSettings,
  LogRowContextOptions,
  LogRowModel,
  PluginType,
  QueryFixAction,
  SupplementaryQueryOptions,
  SupplementaryQueryType,
  TimeRange,
} from '@grafana/data';
import { DataSourceWithBackend } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';

import { LokiDatasource, LokiQuery } from '@/services/lokiTypes';

export const mockInstanceSettings: DataSourceInstanceSettings = {
  id: 1,
  uid: 'loki-app',
  type: 'loki',
  name: 'Loki Data Source',
  meta: {
    id: '1',
    name: 'Loki Data Source',
    type: PluginType.datasource,
    info: {
      author: {
        name: '',
      },
      description: '',
      links: [],
      logos: {
        large: '',
        small: '',
      },
      screenshots: [],
      updated: '',
      version: '',
    },
    module: '',
    baseUrl: '',
  },
  jsonData: {},
  readOnly: false,
  access: 'direct',
};

export const languageProviderMock = {
  request(url: string, params?: any) {
    return {
      status: 'success',
      data: ['app', 'instance'],
    };
  },
  start(timeRange?: TimeRange) {
    return [];
  },
  getLabelKeys() {
    return ['app', 'instance'];
  },
  importFromAbstractQuery(labelBasedQuery: AbstractQuery) {
    return {};
  },
  exportToAbstractQuery(query: LokiQuery) {
    return {
      labelMatchers: [],
    };
  },
  fetchLabels(options?: { timeRange?: TimeRange }) {
    return Promise.resolve(['app', 'instance']);
  },
  fetchSeriesLabels(streamSelector: string, options?: { timeRange?: TimeRange }) {
    return Promise.resolve({
      app: ['grafana', 'loki'],
      instance: ['instance1'],
    });
  },
  fetchSeries(match: string, options?: { timeRange?: TimeRange }) {
    return Promise.resolve([
      {
        app: 'grafana',
        instance: 'instance1',
      },
      {
        app: 'loki',
      },
    ]);
  },
  fetchLabelValues(labelName: string, options?: { streamSelector?: string; timeRange?: TimeRange }) {
    const labelValues: Record<string, string[]> = {
      app: ['grafana', 'loki'],
      instance: ['instance1', 'instance2'],
    };
    return Promise.resolve(labelValues[labelName]);
  },
  getParserAndLabelKeys(streamSelector: string, options?: { maxLines?: number; timeRange?: TimeRange }) {
    return Promise.resolve({
      extractedLabelKeys: [],
      structuredMetadataKeys: [],
      hasJSON: true,
      hasLogfmt: true,
      hasPack: false,
      unwrapLabelKeys: [],
    });
  },
};

// Not all methods are implemented
// @ts-expect-error
export class LokiDatasourceMock extends DataSourceWithBackend<DataQuery> implements LokiDatasource {
  constructor(instanceSettings = mockInstanceSettings) {
    super(instanceSettings);
    this.languageProvider = {
      ...languageProviderMock,
      dataSource: this,
    };
  }

  // @ts-ignore
  query(request: DataQueryRequest<LokiQuery>) {
    return of({ data: [] });
  }

  showContextToggle() {
    return true;
  }

  getLogRowContext(row: LogRowModel, options?: LogRowContextOptions, query?: DataQuery) {
    return Promise.resolve({
      data: [],
    });
  }

  exportToAbstractQueries(query: DataQuery[]) {
    return Promise.resolve([]);
  }

  importFromAbstractQueries(labelBasedQuery: AbstractQuery[]) {
    return Promise.resolve([]);
  }

  modifyQuery(query: LokiQuery, action: QueryFixAction) {
    return query;
  }

  getSupportedQueryModifications() {
    return [];
  }

  getDataProvider(type: SupplementaryQueryType, request: DataQueryRequest<DataQuery>) {
    return undefined;
  }

  getSupplementaryRequest(
    type: SupplementaryQueryType,
    query: DataQueryRequest<LokiQuery>,
    options: SupplementaryQueryOptions
  ) {
    return query;
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume];
  }

  getSupplementaryQuery(options: SupplementaryQueryOptions, originalQuery: LokiQuery) {
    return originalQuery;
  }
}
