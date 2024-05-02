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
import { VAR_DATASOURCE_EXPR, LOG_STREAM_SELECTOR_EXPR, VAR_FILTERS, ALL_VARIABLE_VALUE } from './variables';
import { EXPLORATIONS_ROUTE } from './routing';
import { IndexScene } from 'Components/IndexScene/IndexScene';

export function getExplorationFor(model: SceneObject): IndexScene {
  return sceneGraph.getAncestor(model, IndexScene);
}

export function newLogsExploration(initialDS?: string): IndexScene {
  return new IndexScene({
    initialDS,
    $timeRange: new SceneTimeRange({ from: 'now-15m', to: 'now' }),
  });
}

export function getUrlForExploration(exploration: IndexScene) {
  const params = getUrlSyncManager().getUrlState(exploration);
  return getUrlForValues(params);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(EXPLORATIONS_ROUTE, values);
}

export function getDataSource(exploration: IndexScene) {
  return sceneGraph.interpolate(exploration, VAR_DATASOURCE_EXPR);
}

export function getQueryExpr(exploration: IndexScene) {
  return sceneGraph.interpolate(exploration, LOG_STREAM_SELECTOR_EXPR).replace(/\s+/g, ' ');
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

export async function getLokiDatasource(sceneObject: SceneObject) {
  const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: sceneObject } })) as
    | DataSourceWithBackend
    | undefined;
  return ds;
}
