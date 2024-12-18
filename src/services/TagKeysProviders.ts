import { logger } from './logger';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { DataSourceGetTagKeysOptions, GetTagResponse, MetricFindValue } from '@grafana/data';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getDataSource } from './scenes';
import { LABELS_TO_REMOVE } from './filters';
import { joinTagFilters } from './query';

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

    const tagKeys = await datasource.getTagKeys(options);
    const result: MetricFindValue[] = Array.isArray(tagKeys) ? tagKeys : [];
    const filteredResult = result.filter((key) => !LABELS_TO_REMOVE.includes(key.text));

    return { replace: true, values: filteredResult };
  } else {
    logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}
