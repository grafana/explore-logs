import { logger } from './logger';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import {
  DataSourceGetTagKeysOptions,
  getDefaultTimeRange,
  GetTagResponse,
  KeyValue,
  MetricFindValue,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { AdHocFiltersVariable, SceneObject } from '@grafana/scenes';
import { BackendSrvRequest, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { LABELS_TO_REMOVE } from './filters';
import { joinTagFilters } from './query';
import { DetectedFieldsResult, LokiLanguageProviderWithDetectedLabelValues } from './TagValuesProviders';
import { LEVEL_VARIABLE_VALUE, ParserType, VAR_FIELDS_AND_METADATA, VAR_LEVELS } from './variables';
import { UIVariableFilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';

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

type DetectedFieldQueryOptions = {
  expr: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
  sceneRef: SceneObject;
  variableType: UIVariableFilterType;
};

export async function getFieldsKeysProvider({
  limit,
  timeRange,
  scopedVars,
  expr,
  sceneRef,
  variableType,
}: DetectedFieldQueryOptions): Promise<{
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

  const options: DetectedFieldQueryOptions = {
    expr,
    timeRange,
    scopedVars,
    variableType,
    sceneRef,
    limit,
  };

  // @todo delete after min supported grafana is upgraded to >=11.6
  // see ced526b3e37baded9082ffc3c2378a21201801b6 before this all got messed up
  const fetchDetectedFieldsFn =
    (datasource &&
      typeof languageProvider.fetchDetectedFields === 'function' &&
      languageProvider.fetchDetectedFields.bind(languageProvider)) ||
    function (opts: DetectedFieldQueryOptions) {
      return fetchDetectedFields(datasource, opts);
    };

  // fetchDetectedFields did not make the 11.5 cutoff, so is only available in 11.6, to keep this PR from needing to wait for 2 months before release, we're going to copy over the implementation into Explore Logs
  if (fetchDetectedFieldsFn && typeof fetchDetectedFieldsFn === 'function') {
    const tagKeys: DetectedFieldsResult | Error = await fetchDetectedFieldsFn(options);

    if (tagKeys instanceof Error) {
      logger.error(tagKeys, { msg: 'Failed to fetch detected fields' });
      throw tagKeys;
    }

    const result: MetricFindValue[] = tagKeys
      .filter((field) => {
        if (variableType === VAR_LEVELS) {
          return field.label === LEVEL_VARIABLE_VALUE;
        }

        if (variableType === VAR_FIELDS_AND_METADATA && field.label !== LEVEL_VARIABLE_VALUE) {
          return true;
        }

        return field.parsers !== null;
      })
      .map((field) => {
        if (variableType === VAR_FIELDS_AND_METADATA) {
          let parser: ParserType = field.parsers?.length === 1 ? field.parsers[0] : 'mixed';
          if (field.parsers === null) {
            parser = 'structuredMetadata';
          }

          const type = field.type;

          return {
            text: field.label,
            value: field.label,
            group: parser,
            meta: {
              parser,
              type,
            },
          };
        }

        return { text: field.label, value: field.label };
      });

    result.sort((a, b) => {
      if (a.group === 'structuredMetadata' && b.group !== 'structuredMetadata') {
        return -1;
      }
      if (a.group !== 'structuredMetadata' && b.group === 'structuredMetadata') {
        return 1;
      }
      return 0;
    });

    return { replace: true, values: result };
  } else {
    logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}

const EMPTY_SELECTOR = '{}';
// @todo delete after min supported grafana is upgraded to >=11.6
async function fetchDetectedFields(
  datasource: LokiDatasource,
  queryOptions: DetectedFieldQueryOptions,
  requestOptions?: Partial<BackendSrvRequest>
): Promise<DetectedFieldsResult | Error> {
  if (!('interpolateString' in datasource) || typeof datasource?.interpolateString !== 'function') {
    throw new Error('Datasource missing interpolateString method');
  }

  const interpolatedExpr =
    queryOptions.expr && queryOptions.expr !== EMPTY_SELECTOR
      ? datasource.interpolateString(queryOptions.expr, queryOptions.scopedVars)
      : undefined;

  if (!interpolatedExpr) {
    throw new Error('fetchDetectedFields requires query expression');
  }

  const url = `detected_fields`;
  const range = queryOptions?.timeRange ?? getDefaultTimeRange();
  const rangeParams = datasource.getTimeRangeParams(range);
  const { start, end } = rangeParams;
  const params: KeyValue<string | number> = { start, end, limit: queryOptions?.limit ?? 1000 };
  params.query = interpolatedExpr;

  return new Promise(async (resolve, reject) => {
    try {
      const data: { limit: number; fields: DetectedFieldsResult } = await datasource.getResource(
        url,
        params,
        requestOptions
      );
      resolve(data.fields);
    } catch (error) {
      console.error('error', error);
      reject(error);
    }
  });
}
