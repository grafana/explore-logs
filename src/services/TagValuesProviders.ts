import { AdHocFiltersVariable, AdHocFilterWithLabels, SceneObject } from '@grafana/scenes';
import { DataSourceGetTagValuesOptions, GetTagResponse, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { logger } from './logger';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { getDataSourceVariable, getValueFromFieldsFilter } from './variableGetters';
import { VAR_FIELDS, VAR_LEVELS, VAR_METADATA } from './variables';
import { isArray } from 'lodash';
import { joinTagFilters } from './query';
import { FilterOp } from './filterTypes';
import { getFavoriteLabelValuesFromStorage } from './store';
import { isOperatorInclusive, isOperatorRegex } from './operators';

type FetchDetectedLabelValuesOptions = {
  expr?: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
  throwError: boolean;
};

export type FetchDetectedFieldsOptions = {
  expr: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
};

export type DetectedFieldsResult = Array<{
  label: string;
  type: 'bytes' | 'float' | 'int' | 'string' | 'duration';
  cardinality: number;
  parsers: Array<'logfmt' | 'json'> | null;
}>;

export interface LokiLanguageProviderWithDetectedLabelValues {
  fetchDetectedLabelValues: (
    labelName: string,
    queryOptions?: FetchDetectedLabelValuesOptions,
    requestOptions?: Partial<BackendSrvRequest>
  ) => Promise<string[] | Error>;

  fetchDetectedFields: (
    queryOptions?: FetchDetectedFieldsOptions,
    requestOptions?: Partial<BackendSrvRequest>
  ) => Promise<DetectedFieldsResult | Error>;
}

export const getDetectedFieldValuesTagValuesProvider = async (
  filter: AdHocFilterWithLabels<{ parser: 'json' | 'logfmt' | 'mixed' }>,
  variable: AdHocFiltersVariable,
  expr: string,
  sceneRef: SceneObject,
  timeRange: TimeRange,
  variableType: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS
): Promise<{
  replace?: boolean;
  values: MetricFindValue[];
}> => {
  const datasourceUnknownType = await getDataSourceSrv().get(getDataSource(sceneRef));
  // Narrow the DataSourceApi type to DataSourceWithBackend
  if (!(datasourceUnknownType instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }

  // Assert datasource is Loki
  const lokiDatasource = datasourceUnknownType as LokiDatasource;
  // Assert language provider is LokiLanguageProvider
  const languageProvider = lokiDatasource.languageProvider as LokiLanguageProviderWithDetectedLabelValues;

  let values: MetricFindValue[] = [];

  if (languageProvider && languageProvider.fetchDetectedLabelValues) {
    const options: FetchDetectedLabelValuesOptions = {
      expr,
      limit: 1000,
      timeRange,
      throwError: true,
    };

    const requestOptions: Partial<BackendSrvRequest> = {
      showErrorAlert: false,
    };

    try {
      let results = await languageProvider.fetchDetectedLabelValues(filter.key, options, requestOptions);
      // If the variable has a parser in the value, make sure we extract it and carry it over, this assumes the parser for the currently selected value is the same as any value in the response.
      // @todo is the parser always the same for the currently selected values and the results from detected_field/.../values?
      if (results && isArray(results)) {
        const currentFilters = variable.state.filters;

        // Remove values that are already used, if an exact match is found
        let valuesToRemove: string[] = [];
        currentFilters.forEach((filter) => {
          if (isOperatorRegex(filter.operator)) {
            filter.value.split('|').forEach((v) => valuesToRemove.push(v));
          } else {
            valuesToRemove.push(filter.value);
          }
        });

        const filteredResults = results.filter((value) => {
          return !valuesToRemove.includes(value);
        });
        if (variableType === VAR_FIELDS) {
          if (filter.value) {
            const valueDecoded = getValueFromFieldsFilter(filter, variableType);
            return {
              replace: true,
              values: filteredResults.map((v) => ({
                text: v,
                value: JSON.stringify({
                  value: v,
                  parser: valueDecoded.parser,
                }),
              })),
            };
          } else {
            // if the filter is wip, it won't have a value yet, so we need to get the parser from somewhere
            // It's annoying that there's no metadata on the ad-hoc filters because in this situation we just threw away the parser from the getTagKeys (detected_fields)
            // We can check the detected_fields frame, but it was a different call and could have different results

            return {
              replace: true,
              values: filteredResults.map((v) => ({
                text: v,
                value: JSON.stringify({
                  value: v,
                  parser: filter.meta?.parser ?? 'mixed',
                }),
              })),
            };
          }
        } else {
          values = filteredResults.map((r) => ({ text: r }));
        }
      } else {
        values = [];
      }
    } catch (e) {
      logger.error(e, {
        msg: 'getDetectedFieldValuesTagValuesProvider: loki missing detected_field/.../values endpoint. Upgrade to Loki 3.3.0 or higher.',
      });
      values = [];
    }
  } else {
    logger.warn(
      'getDetectedFieldValuesTagValuesProvider: fetchDetectedLabelValues is not defined in Loki datasource. Upgrade to Grafana 11.4 or higher.'
    );
    values = [];
  }

  return { replace: true, values };
};

export async function getLabelsTagValuesProvider(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels<{ meta: string }>
): Promise<{
  replace?: boolean;
  values: GetTagResponse | MetricFindValue[];
}> {
  const datasource_ = await getDataSourceSrv().get(getDataSource(variable));
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }
  const datasource = datasource_ as LokiDatasource;

  if (datasource && datasource.getTagValues) {
    // Filter out other values for this key so users can include other values for this label
    let filters = joinTagFilters(variable).filter(
      (f) => !(isOperatorInclusive(filter.operator) && f.key === filter.key)
    );

    // If there aren't any inclusive filters, we need to ignore the exclusive ones as well, or Loki will throw an error
    if (!filters.some((filter) => isOperatorInclusive(filter.operator))) {
      filters = [];
    }

    const options: DataSourceGetTagValuesOptions<LokiQuery> = {
      key: filter.key,
      filters,
    };
    let results = await datasource.getTagValues(options);

    if (isArray(results)) {
      results = results.filter((result) => {
        // Filter out values that we already have added as filters
        return !variable.state.filters
          .filter((f) => f.key === filter.key)
          .some((f) => {
            if (isOperatorRegex(f.operator)) {
              const values = f.value.split('|');
              return values.some((value) => value === result.text);
            } else {
              // If true, the results should be filtered out
              return f.operator === FilterOp.Equal && f.value === result.text;
            }
          });
      });
      const favoriteValuesArray = getFavoriteLabelValuesFromStorage(
        getDataSourceVariable(variable).getValue()?.toString(),
        filter.key
      );
      const favoriteValuesSet = new Set(favoriteValuesArray);
      if (favoriteValuesArray.length) {
        results.sort((a, b) => {
          return (favoriteValuesSet.has(b.text) ? 1 : -1) - (favoriteValuesSet.has(a.text) ? 1 : -1);
        });
      }
    }

    return { replace: true, values: results };
  } else {
    logger.error(new Error('getTagValuesProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}
