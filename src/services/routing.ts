import pluginJson from '../plugin.json';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import {
  SERVICE_NAME,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_PATTERNS,
  VAR_SERVICE,
} from './variables';
import { locationService } from '@grafana/runtime';
import { RouteMatch, RouteProps } from '../Components/Pages';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

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

export function replaceSlash(parameter: string): string {
  return parameter.replace(/\//g, '-');
}

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
  explore: prefixRoute(PageSlugs.explore),
  logs: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${PageSlugs.logs}`),
  fields: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${PageSlugs.fields}`),
  patterns: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${PageSlugs.patterns}`),
  labels: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${PageSlugs.labels}`),
};

export const CHILD_ROUTE_DEFINITIONS: Record<keyof typeof ValueSlugs, string> = {
  field: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${ValueSlugs.field}/:breakdownLabel`),
  label: prefixRoute(`${PageSlugs.explore}/:labelName/:labelValue/${ValueSlugs.label}/:breakdownLabel`),
};

export const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/${PageSlugs.explore}`;

// Prefixes the route with the base URL of the plugin
export function prefixRoute(route: string): string {
  return `${PLUGIN_BASE_URL}/${route}`;
}

// For redirect back to service, we just want to keep datasource, and timerange
export const SERVICE_URL_KEYS = ['from', 'to', `var-${VAR_DATASOURCE}`];
//@todo why patterns and var-patterns?
export const DRILLDOWN_URL_KEYS = [
  'from',
  'to',
  'mode',
  'urlColumns',
  'visualizationType',
  'selectedLine',
  'displayedFields',
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
];

export function getDrilldownSlug() {
  const location = locationService.getLocation();
  const slug = location.pathname.slice(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
  return slug as PageSlugs;
}

/**
 * The "primary" label, is the replacement for the service_name paradigm
 * It must be an indexed label with an include filter
 * Note: Will return the label as it exists in the url
 */
export function getPrimaryLabelFromUrl(): RouteProps {
  const location = locationService.getLocation();
  const startOfUrl = '/a/grafana-lokiexplore-app/explore';
  const endOfUrl = location.pathname.slice(location.pathname.indexOf(startOfUrl) + startOfUrl.length + 1);
  const routeParams = endOfUrl.split('/');
  let labelName = routeParams[0];
  const labelValue = routeParams[1];
  const breakdownLabel = routeParams?.[3];
  // Keep urls the same
  if (labelName === SERVICE_NAME) {
    labelName = VAR_SERVICE;
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

export function createAppUrl(path = '/explore', urlParams?: URLSearchParams): string {
  return `/a/${pluginJson.id}${path}${urlParams ? `?${urlParams.toString()}` : ''}`;
}

export const UrlParameters = {
  DatasourceId: `var-${VAR_DATASOURCE}`,
  TimeRangeFrom: 'from',
  TimeRangeTo: 'to',
  Labels: `var-${VAR_LABELS}`,
  Fields: `var-${VAR_FIELDS}`,
} as const;
export type UrlParameterType = (typeof UrlParameters)[keyof typeof UrlParameters];

export function setUrlParameter(key: UrlParameterType, value: string, initalParams?: URLSearchParams): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.set(key, value);

  return searchParams;
}

export function appendUrlParameter(
  key: UrlParameterType,
  value: string,
  initalParams?: URLSearchParams
): URLSearchParams {
  const searchParams = new URLSearchParams(initalParams?.toString() ?? location.search);
  searchParams.append(key, value);

  return searchParams;
}
