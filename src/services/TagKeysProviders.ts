import { logger } from './logger';
import { LokiQuery } from './lokiQuery';
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
  const datasource = datasource_ as DataSourceWithBackend<LokiQuery>;

  if (datasource && datasource.getTagKeys) {
    const filters = joinTagFilters(variable);

    const options: DataSourceGetTagKeysOptions<LokiQuery> = {
      filters,
    };

    const result = (await datasource.getTagKeys(options)) as MetricFindValue[];
    const filteredResult = result.filter((key) => !LABELS_TO_REMOVE.includes(key.text));

    return { replace: true, values: filteredResult };
  } else {
    logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
    return { replace: true, values: [] };
  }
}
