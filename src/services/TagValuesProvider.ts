import { SceneObject } from '@grafana/scenes';
import { AdHocVariableFilter, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';
import { BackendSrvRequest, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { logger } from './logger';
import { LokiQuery } from './lokiQuery';
import { getValueFromFieldsFilter } from './variableGetters';
import { VAR_FIELDS, VAR_LEVELS, VAR_METADATA } from './variables';
import { isArray } from 'lodash';

//@todo export from scenes
export interface AdHocFilterWithLabels extends AdHocVariableFilter {
  keyLabel?: string;
  valueLabels?: string[];
}

type FetchDetectedLabelValuesOptions = {
  expr?: string;
  timeRange?: TimeRange;
  limit?: number;
  scopedVars?: ScopedVars;
  throwError: boolean;
};

interface LokiLanguageProviderWithDetectedLabelValues {
  fetchDetectedLabelValues: (
    labelName: string,
    queryOptions?: FetchDetectedLabelValuesOptions,
    requestOptions?: Partial<BackendSrvRequest>
  ) => Promise<string[] | Error>;
}

export const getDetectedFieldValuesTagValuesProvider = async (
  filter: AdHocFilterWithLabels,
  expr: string,
  sceneRef: SceneObject,
  timeRange: TimeRange,
  variable: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS
): Promise<{
  replace?: boolean;
  values: MetricFindValue[];
}> => {
  const datasourceUnknownType = await getDataSourceSrv().get(getDataSource(sceneRef));
  // Narrow the DataSourceApi type to DataSourceWithBackend
  if (!(datasourceUnknownType instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource! usless change'));
    throw new Error('Invalid datasource!');
  }

  // Assert datasource is Loki
  const lokiDatasource = datasourceUnknownType as DataSourceWithBackend<LokiQuery>;
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
        if (variable === VAR_FIELDS) {
          const valueDecoded = getValueFromFieldsFilter(filter, variable);
          return {
            replace: true,
            values: results.map((v) => ({
              text: v,
              value: JSON.stringify({
                value: v,
                parser: valueDecoded.parser,
              }),
            })),
          };
        } else {
          values = results.map((r) => ({ text: r }));
        }
      } else {
        values = [];
      }
    } catch (e) {
      logger.error(e);
      logger.warn(
        'getDetectedFieldValuesTagValuesProvider: loki missing detected_field/.../values endpoint. Upgrade to Loki 3.3.0 or higher.'
      );
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
