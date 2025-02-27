import { UrlQueryMap, urlUtil } from '@grafana/data';
import {
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LINE_FILTERS,
  VAR_METADATA,
  VAR_PATTERNS,
} from './variables';
import { locationService } from '@grafana/runtime';
import { RouteMatch, RouteProps } from '../Components/Pages';
import { replaceSlash } from './extensions/links';
import { SceneObject } from '@grafana/scenes';
import { getLabelsVariable } from './variableGetters';
import { logger } from './logger';
import { PLUGIN_BASE_URL, prefixRoute } from './plugin';

export enum PageSlugs {
  explore = 'explore',
  logs = 'logs',
  labels = 'labels',
  patterns = 'patterns',
  fields = 'fields',
}
export enum ValueSlugs {
  field = 'field',
  label = 'label',
}

export type ParentDrilldownSlugs =
  | PageSlugs.explore
  | PageSlugs.fields
  | PageSlugs.logs
  | PageSlugs.labels
  | PageSlugs.patterns;
export type ChildDrilldownSlugs = ValueSlugs.field | ValueSlugs.label;

export const ROUTES = {
  explore: () => prefixRoute(PageSlugs.explore),
  logs: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.logs}`),
  fields: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.fields}`),
  patterns: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.patterns}`),
  labels: (labelValue: string, labelName = 'service') =>
    prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.labels}`),
};

export const SUB_ROUTES = {
  label: (labelValue: string, labelName = 'service', breakdownLabelName: string) =>
    prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${ValueSlugs.label}/${breakdownLabelName}`
    ),
  field: (labelValue: string, labelName = 'service', breakdownLabelName: string) =>
    prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${ValueSlugs.field}/${breakdownLabelName}`
    ),
};

export const ROUTE_DEFINITIONS: Record<keyof typeof PageSlugs, string> = {
  explore: `${PageSlugs.explore}/*`,
  logs: `:labelName/:labelValue/${PageSlugs.logs}`,
  fields: `:labelName/:labelValue/${PageSlugs.fields}`,
  patterns: `:labelName/:labelValue/${PageSlugs.patterns}`,
  labels: `:labelName/:labelValue/${PageSlugs.labels}`,
};

export const CHILD_ROUTE_DEFINITIONS: Record<keyof typeof ValueSlugs, string> = {
  field: `:labelName/:labelValue/${ValueSlugs.field}/:breakdownLabel`,
  label: `:labelName/:labelValue/${ValueSlugs.label}/:breakdownLabel`,
};

export const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/${PageSlugs.explore}`;

// For redirect back to service, we just want to keep datasource, and timerange
export const SERVICE_URL_KEYS = ['from', 'to', `var-${VAR_DATASOURCE}`, `var-${VAR_LABELS}`];
//@todo why patterns and var-patterns?
export const DRILLDOWN_URL_KEYS = [
  'from',
  'to',
  'mode',
  'urlColumns',
  'visualizationType',
  'selectedLine',
  'displayedFields',
  'panelState',
  VAR_PATTERNS,
  `var-${VAR_PATTERNS}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LABELS}`,
  `var-${VAR_FIELDS}`,
  `var-${VAR_LEVELS}`,
  `var-${VAR_FIELD_GROUP_BY}`,
  `var-${VAR_LABEL_GROUP_BY}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LINE_FILTER}`,
  `var-${VAR_METADATA}`,
  `var-${VAR_LINE_FILTERS}`,
];

export function getDrilldownSlug() {
  const location = locationService.getLocation();
  const slug = location.pathname.slice(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
  return slug as PageSlugs;
}

/**
 * The "primary" label, is the replacement for the service_name paradigm
 * It must be an indexed label with an include filter
 * Note: Will return the label as it exists in the url, so "service_name" will be returned as "service", we'll need to adjust for this case if we want to support URLs from before this change
 */
export function getPrimaryLabelFromUrl(): RouteProps {
  const location = locationService.getLocation();
  const startOfUrl = '/a/grafana-lokiexplore-app/explore';
  const endOfUrl = location.pathname.slice(location.pathname.indexOf(startOfUrl) + startOfUrl.length + 1);
  const routeParams = endOfUrl.split('/');

  let labelName = routeParams[0];
  const labelValue = routeParams[1];
  const breakdownLabel = routeParams[3];
  // Keep urls the same
  if (labelName === SERVICE_NAME) {
    labelName = SERVICE_UI_LABEL;
  }
  return { labelName, labelValue, breakdownLabel };
}

export function getDrilldownValueSlug() {
  const location = locationService.getLocation();
  const locationArray = location.pathname.split('/');
  const slug = locationArray[locationArray.length - 2];
  return slug as ValueSlugs;
}

export function buildServicesUrl(path: string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildServicesRoute(extraQueryParams));
}
export function extractValuesFromRoute(routeMatch: RouteMatch): RouteProps {
  return {
    labelName: routeMatch.params.labelName,
    labelValue: routeMatch.params.labelValue,
    breakdownLabel: routeMatch.params.breakdownLabel,
  };
}

export function buildServicesRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
  return {
    ...Object.entries(urlUtil.getUrlSearchParams()).reduce<UrlQueryMap>((acc, [key, value]) => {
      if (SERVICE_URL_KEYS.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {}),
    ...extraQueryParams,
  };
}

/**
 * Compare slugs against variable filters and log discrepancies
 * These don't cause errors or render empty UIs, but shouldn't be possible when routing within the app
 * If we see these logged in production it indicates we're navigating users incorrectly
 * @param sceneRef
 */
export function checkPrimaryLabel(sceneRef: SceneObject) {
  const labelsVariable = getLabelsVariable(sceneRef);
  let { labelName, labelValue } = getPrimaryLabelFromUrl();
  if (labelName === SERVICE_UI_LABEL) {
    labelName = SERVICE_NAME;
  }
  const primaryLabel = labelsVariable.state.filters.find((filter) => filter.key === labelName);
  if (!primaryLabel) {
    const location = locationService.getLocation();

    logger.info('invalid primary label name in url', {
      labelName,
      url: `${location.pathname}${location.search}`,
    });
  }

  const primaryLabelValue = labelsVariable.state.filters.find((filter) => replaceSlash(filter.value) === labelValue);
  if (!primaryLabelValue) {
    const location = locationService.getLocation();

    logger.info('invalid primary label value in url', {
      labelValue,
      url: `${location.pathname}${location.search}`,
    });
  }
}
