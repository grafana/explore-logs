import { SelectableValue, urlUtil } from '@grafana/data';
import { DataSourceWithBackend, config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  getUrlSyncManager,
  sceneGraph,
  SceneObject,
  SceneObjectUrlValues,
  SceneTimeRange,
} from '@grafana/scenes';

import { LogExploration } from '../pages/Explore';
import {
  ALL_VARIABLE_VALUE,
  EXPLORATIONS_ROUTE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE_EXPR,
  VAR_FILTERS,
} from './shared';

export function getExplorationFor(model: SceneObject): LogExploration {
  return sceneGraph.getAncestor(model, LogExploration);
}

export function newLogsExploration(initialDS?: string): LogExploration {
  return new LogExploration({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-15m', to: 'now' }),
  });
}

export function getUrlForExploration(exploration: LogExploration) {
  const params = getUrlSyncManager().getUrlState(exploration);
  return getUrlForValues(params);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(EXPLORATIONS_ROUTE, values);
}

export function getDataSource(exploration: LogExploration) {
  return sceneGraph.interpolate(exploration, VAR_DATASOURCE_EXPR);
}

export function getQueryExpr(exploration: LogExploration) {
  return sceneGraph.interpolate(exploration, LOG_STREAM_SELECTOR_EXPR).replace(/\s+/g, ' ');
}

export function getDataSourceName(dataSourceUid: string) {
  return getDataSourceSrv().getInstanceSettings(dataSourceUid)?.name || dataSourceUid;
}

export function getDatasourceForNewExploration(): string | undefined {
  const typeDatasources = getDataSourceSrv().getList({ type: 'loki' });
  if (typeDatasources.length > 0) {
    return typeDatasources.find((mds) => mds.uid === config.defaultDatasource)?.uid ?? typeDatasources[0].uid;
  }
  return undefined;
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export function getLabelOptions(scenObject: SceneObject, allOptions: string[]) {
  const labelFilters = sceneGraph.lookupVariable(VAR_FILTERS, scenObject);
  const labelOptions: Array<SelectableValue<string>> = [];

  if (!(labelFilters instanceof AdHocFiltersVariable)) {
    return [];
  }

  const filters = labelFilters.state.filters;

  for (const option of allOptions) {
    const filterExists = filters.find((f) => f.key === option);
    if (!filterExists) {
      labelOptions.push({ label: option, value: String(option) });
    }
  }

  const levelOption = [];
  if (!allOptions.includes('level')) {
    levelOption.push({ label: 'level', value: 'level' });
  }

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...levelOption, ...labelOptions];
}

export async function getDatasource(sceneObject: SceneObject) {
  const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: sceneObject } })) as
    | DataSourceWithBackend
    | undefined;
  return ds;
}
