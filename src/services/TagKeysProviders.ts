import { logger } from './logger';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { DataSourceGetTagKeysOptions, GetTagResponse, MetricFindValue, TimeRange } from '@grafana/data';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { LABELS_TO_REMOVE } from './filters';
import { joinTagFilters } from './query';
import {
  DetectedFieldsResult,
  FetchDetectedFieldsOptions,
  LokiLanguageProviderWithDetectedLabelValues,
} from './TagValuesProviders';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LEVELS, VAR_METADATA } from './variables';

export async function getLabelsTagKeysProvider(variable: AdHocFiltersVariable): Promise<{
  replace?: boolean;
  values: GetTagResponse | MetricFindValue[];
}> {
  const datasource_ = await getDataSourceSrv().get(getDataSource(variable));
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagKeysProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;

  if (datasource && datasource.getTagKeys) {
    const filters = joinTagFilters(variable);

    const options: DataSourceGetTagKeysOptions<LokiQuery> = {
      filters,
    };

    // Do we want to only have regex operations?
    const tagKeys = await datasource.getTagKeys(options);
    const result: MetricFindValue[] = Array.isArray(tagKeys) ? tagKeys : [];
    const filteredResult = result.filter((key) => !LABELS_TO_REMOVE.includes(key.text));

    return { replace: true, values: filteredResult };
  } else {
    logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}

export async function getFieldsKeysProvider(
  expr: string,
  sceneRef: SceneObject,
  timeRange: TimeRange,
  variable: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS
): Promise<{
  replace?: boolean;
  values: MetricFindValue[];
}> {
  const datasource_ = await getDataSourceSrv().get(getDataSource(sceneRef));
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagKeysProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;
  const languageProvider = datasource.languageProvider as LokiLanguageProviderWithDetectedLabelValues;

  if (datasource && typeof languageProvider.fetchDetectedFields === 'function') {
    const options: FetchDetectedFieldsOptions = {
      expr,
      timeRange,
    };

    const tagKeys: DetectedFieldsResult = await datasource.languageProvider.fetchDetectedFields(options);
    const result: MetricFindValue[] = tagKeys
      .filter((field) => {
        if (variable === VAR_METADATA && field.label !== LEVEL_VARIABLE_VALUE) {
          return field.parsers === null;
        }

        if (variable === VAR_LEVELS) {
          return field.label === LEVEL_VARIABLE_VALUE;
        }

        return field.parsers !== null;
      })
      .map((field) => {
        if (variable === VAR_FIELDS) {
          if (field.parsers === null) {
            console.warn('Fields should not get metadata!');
          }

          const parser = field.parsers?.length === 1 ? field.parsers[0] : 'mixed';

          return {
            text: field.label,
            value: field.label,
            group: parser,
            meta: {
              parser,
            },
          };
        }

        return { text: field.label, value: field.label };
      });

    return { replace: true, values: result };
  } else {
    logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}
