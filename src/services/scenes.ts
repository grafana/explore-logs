import { AdHocVariableFilter, urlUtil } from '@grafana/data';
import { config, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { sceneGraph, SceneObject, SceneObjectUrlValues, SceneQueryRunner, SceneTimePicker } from '@grafana/scenes';
import { LOG_STREAM_SELECTOR_EXPR, VAR_DATASOURCE_EXPR, VAR_LABELS_EXPR } from './variables';
import { EXPLORATIONS_ROUTE } from './routing';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { logger } from './logger';

export function getExplorationFor(model: SceneObject): IndexScene {
  return sceneGraph.getAncestor(model, IndexScene);
}

export function getUrlForValues(values: SceneObjectUrlValues) {
  return urlUtil.renderUrl(EXPLORATIONS_ROUTE, values);
}

export function getDataSource(sceneObject: SceneObject) {
  return sceneGraph.interpolate(sceneObject, VAR_DATASOURCE_EXPR);
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

export function getQueryRunnerFromChildren(sceneObject: SceneObject) {
  return sceneGraph.findDescendents(sceneObject, SceneQueryRunner);
}

//@todo export from scenes
export interface AdHocFilterWithLabels extends AdHocVariableFilter {
  keyLabel?: string;
  valueLabels?: string[];
}

interface SceneType<T> extends Function {
  new (...args: never[]): T;
}

export function findObjectOfType<T extends SceneObject>(
  scene: SceneObject,
  check: (obj: SceneObject) => boolean,
  returnType: SceneType<T>
) {
  const obj = sceneGraph.findObject(scene, check);
  if (obj instanceof returnType) {
    return obj;
  } else if (obj !== null) {
    logger.warn(`invalid return type: ${returnType.toString()}`);
  }

  return null;
}

export function getTimePicker(scene: IndexScene) {
  return scene.state.controls?.find((s) => s instanceof SceneTimePicker) as SceneTimePicker;
}
