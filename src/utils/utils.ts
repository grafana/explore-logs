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
import { IndexScene } from 'Components/Index/IndexScene';
import {
  VAR_DATASOURCE_EXPR,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FILTERS,
  ALL_VARIABLE_VALUE,
} from './shared';
import { EXPLORATIONS_ROUTE } from './routing';

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

export const copyText = async (text: string, buttonRef: React.MutableRefObject<HTMLButtonElement | null>) => {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  // eslint-disable-next-line deprecation/deprecation
  } else if (document.execCommand) {
    // Use a fallback method for browsers/contexts that don't support the Clipboard API.
    // See https://web.dev/async-clipboard/#feature-detection.
    // Use textarea so the user can copy multi-line content.
    const textarea = document.createElement('textarea');
    // Normally we'd append this to the body. However if we're inside a focus manager
    // from react-aria, we can't focus anything outside of the managed area.
    // Instead, let's append it to the button. Then we're guaranteed to be able to focus + copy.
    buttonRef.current?.appendChild(textarea);
    textarea.value = text;
    textarea.focus();
    textarea.select();
    // eslint-disable-next-line deprecation/deprecation
    document.execCommand('copy');
    textarea.remove();
  }
};
