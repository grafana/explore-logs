import pluginJson from '../plugin.json';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import {
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_LABEL_GROUP_BY,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from './variables';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

export enum SLUGS {
  explore = 'explore',
  logs = 'logs',
  labels = 'labels',
  patterns = 'patterns',
  fields = 'fields',
}

export function encodeParameter(parameter: string): string {
  return encodeURIComponent(parameter.replace(/\//g, '---'));
}

export function decodeParameter(parameter: string): string {
  return decodeURIComponent(parameter).replace(/---/g, '/');
}

export const ROUTES = {
  explore: () => prefixRoute(SLUGS.explore),
  logs: (service: string) => prefixRoute(`${SLUGS.explore}/service/${encodeParameter(service)}/${SLUGS.logs}`),
  fields: (service: string) => prefixRoute(`${SLUGS.explore}/service/${encodeParameter(service)}/${SLUGS.fields}`),
  patterns: (service: string) => prefixRoute(`${SLUGS.explore}/service/${encodeParameter(service)}/${SLUGS.patterns}`),
  labels: (service: string) => prefixRoute(`${SLUGS.explore}/service/${encodeParameter(service)}/${SLUGS.labels}`),
};

export const ROUTE_DEFINITIONS: Record<keyof typeof SLUGS, string> = {
  explore: prefixRoute(SLUGS.explore),
  logs: prefixRoute(`${SLUGS.explore}/service/:service/${SLUGS.logs}`),
  fields: prefixRoute(`${SLUGS.explore}/service/:service/${SLUGS.fields}`),
  patterns: prefixRoute(`${SLUGS.explore}/service/:service/${SLUGS.patterns}`),
  labels: prefixRoute(`${SLUGS.explore}/service/:service/${SLUGS.labels}`),
};

export const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/${SLUGS.explore}`;

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
  VAR_PATTERNS,
  `var-${VAR_PATTERNS}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_FILTERS}`,
  `var-${VAR_FIELDS}`,
  `var-${VAR_FIELD_GROUP_BY}`,
  `var-${VAR_LABEL_GROUP_BY}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LOGS_FORMAT}`,
  `var-${VAR_LINE_FILTER}`,
];

export function buildBreakdownUrl(path: string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildBreakdownRoute(extraQueryParams));
}

export function buildBreakdownRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
  return {
    ...Object.entries(urlUtil.getUrlSearchParams()).reduce<UrlQueryMap>((acc, [key, value]) => {
      if (DRILLDOWN_URL_KEYS.includes(key)) {
        acc[key] = value;
      }

      return acc;
    }, {}),
    ...extraQueryParams,
  };
}

export function buildServicesUrl(path: string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildServicesRoute(extraQueryParams));
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
