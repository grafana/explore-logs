import { SceneObject } from '@grafana/scenes';
import { AdHocVariableFilter, MetricFindValue, ScopedVars, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { logger } from './logger';
import { LokiQuery } from './lokiQuery';
import { getValueFromFieldsFilter } from './variableGetters';
import { VAR_FIELDS, VAR_LEVELS, VAR_METADATA } from './variables';

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
};

interface LokiLanguageProviderWithDetectedLabelValues {
  fetchDetectedLabelValues: (
    labelName: string,
    options?: FetchDetectedLabelValuesOptions
  ) => Promise<string[]> | undefined;
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
  const datasource_ = await getDataSourceSrv().get(getDataSource(sceneRef));
  if (!(datasource_ instanceof DataSourceWithBackend)) {
    logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
    throw new Error('Invalid datasource!');
  }
  const datasource = datasource_ as DataSourceWithBackend<LokiQuery>;

  const languageProvider = datasource.languageProvider as LokiLanguageProviderWithDetectedLabelValues;

  if (languageProvider && languageProvider.fetchDetectedLabelValues) {
    // Filter out other values for this key so users can include other values for this label
    const options: FetchDetectedLabelValuesOptions = {
      expr,
      limit: 1000,
      timeRange,
    };

    let results = await languageProvider.fetchDetectedLabelValues(filter.key, options);
    // If the variable has a parser in the value, make sure we extract it and carry it over
    // @todo can the parser ever change?
    if (results && variable === VAR_FIELDS) {
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
    }

    return { replace: true, values: results?.map((v) => ({ text: v })) ?? [] };
  } else {
    logger.warn('getDetectedFieldValuesTagValuesProvider: languageProvider missing fetchDetectedLabelValues!');
    return { replace: true, values: [] };
  }
};
