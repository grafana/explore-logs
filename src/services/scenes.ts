import { urlUtil } from '@grafana/data';
import { DataSourceWithBackend, config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  getUrlSyncManager,
  sceneGraph,
  SceneObject,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { VAR_DATASOURCE_EXPR, LOG_STREAM_SELECTOR_EXPR } from './variables';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { ROUTES } from './routes';

export function getExplorationFor(model: SceneObject): IndexScene {
  return sceneGraph.getAncestor(model, IndexScene);
}
export function getUrlForExploration(exploration: IndexScene) {
  const params = getUrlSyncManager().getUrlState(exploration);
  return getUrlForValues(params);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(ROUTES.explore(), values);
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

export async function getLokiDatasource(sceneObject: SceneObject) {
  const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: sceneObject } })) as
    | DataSourceWithBackend
    | undefined;
  return ds;
}

export function getAdHocFiltersVariable(variableName: string, sceneObject: SceneObject) {
  const variable = sceneGraph.lookupVariable(variableName, sceneObject);

  if (!variable) {
    console.warn(`Could not get AdHocFiltersVariable ${variableName}. Variable not found.`);
    return null;
  }
  if (!(variable instanceof AdHocFiltersVariable)) {
    console.warn(
      `Could not get AdHocFiltersVariable ${variableName}. Variable is not an instance of AdHocFiltersVariable`
    );
    return null;
  }
  return variable;
}
