import { AdHocVariableFilter, SelectableValue, urlUtil } from '@grafana/data';
import { DataSourceWithBackend, config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  getUrlSyncManager,
  sceneGraph,
  SceneObject,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import {
  VAR_DATASOURCE_EXPR,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FILTERS,
  ALL_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS,
  VAR_FILTERS_EXPR,
} from './variables';
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
  return sceneGraph.interpolate(exploration, VAR_FILTERS_EXPR).replace(/\s+/g, ' ');
}

export function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 8]);
}

export function getLabelOptions(sceneObject: SceneObject, allOptions: string[]) {
  const filteredOptions = getUniqueFilters(sceneObject, allOptions);
  const labelOptions: Array<SelectableValue<string>> = filteredOptions.map((label) => ({
    label,
    value: String(label),
  }));

  const levelOption = [];
  // We are adding LEVEL_VARIABLE_VALUE which is structured metadata, but we want to show it as a label
  if (!allOptions.includes(LEVEL_VARIABLE_VALUE)) {
    levelOption.push({ label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE });
  }

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...levelOption, ...labelOptions];
}

/**
 * Given an array of label, or fields names, return those that are not already present in the filters.
 */
export function getUniqueFilters(sceneObject: SceneObject, labelNames: string[]) {
  const labelFilters = sceneGraph.lookupVariable(VAR_FILTERS, sceneObject) as AdHocFiltersVariable | null;
  const fieldsFilters = sceneGraph.lookupVariable(VAR_FIELDS, sceneObject) as AdHocFiltersVariable | null;

  const uniqueFilters: string[] = [];
  let existingFilters: AdHocVariableFilter[] = [];

  if (labelFilters) {
    existingFilters = [...labelFilters.state.filters];
  }
  if (fieldsFilters) {
    existingFilters = [...existingFilters, ...fieldsFilters.state.filters];
  }

  for (const label of labelNames) {
    const filterExists = existingFilters.find((f) => f.key === label);
    if (!filterExists) {
      uniqueFilters.push(label);
    }
  }

  return uniqueFilters;
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
