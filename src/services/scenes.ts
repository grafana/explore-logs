import { urlUtil } from '@grafana/data';
import { config, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { getUrlSyncManager, sceneGraph, SceneObject, SceneObjectUrlValues } from '@grafana/scenes';
import { LOG_STREAM_SELECTOR_EXPR, VAR_DATASOURCE_EXPR, VAR_LABELS_EXPR } from './variables';
import { EXPLORATIONS_ROUTE } from './routing';
import { IndexScene } from 'Components/IndexScene/IndexScene';

export function getExplorationFor(model: SceneObject): IndexScene {
  return sceneGraph.getAncestor(model, IndexScene);
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

export function getPatternExpr(exploration: IndexScene) {
  return sceneGraph.interpolate(exploration, VAR_LABELS_EXPR).replace(/\s+/g, ' ');
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export async function getLokiDatasource(sceneObject: SceneObject) {
  const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: sceneObject } })) as
    | DataSourceWithBackend
    | undefined;
  return ds;
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
