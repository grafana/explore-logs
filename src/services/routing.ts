import pluginJson from '../plugin.json';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import {
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABEL_GROUP_BY,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from './variables';
import { locationService } from '@grafana/runtime';
import { SceneRouteMatch } from '@grafana/scenes';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

export enum PageSlugs {
  explore = 'explore',
  logs = 'logs',
  labels = 'labels',
  patterns = 'patterns',
  fields = 'fields',
}

export const ROUTES = {
  explore: () => prefixRoute(PageSlugs.explore),
  logs: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${service}/${PageSlugs.logs}`),
  fields: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${service}/${PageSlugs.fields}`),
  patterns: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${service}/${PageSlugs.patterns}`),
  labels: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${service}/${PageSlugs.labels}`),
};

export const ROUTE_DEFINITIONS: Record<keyof typeof PageSlugs, string> = {
  explore: prefixRoute(PageSlugs.explore),
  logs: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.logs}`),
  fields: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.fields}`),
  patterns: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.patterns}`),
  labels: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.labels}`),
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
  `selectedLine`,
  VAR_PATTERNS,
  `var-${VAR_PATTERNS}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LABELS}`,
  `var-${VAR_FIELDS}`,
  `var-${VAR_FIELD_GROUP_BY}`,
  `var-${VAR_LABEL_GROUP_BY}`,
  `var-${VAR_DATASOURCE}`,
  `var-${VAR_LOGS_FORMAT}`,
  `var-${VAR_LINE_FILTER}`,
];

export function navigateToIndex() {
  const location = locationService.getLocation();
  const serviceUrl = buildServicesUrl(ROUTES.explore());
  const currentUrl = location.pathname + location.search;

  if (serviceUrl === currentUrl) {
    return;
  }

  locationService.push(serviceUrl);
}

export function navigateToBreakdown(path: PageSlugs | string, extraQueryParams?: UrlQueryMap) {
  const location = locationService.getLocation();
  const pathParts = location.pathname.split('/');
  const currentSlug = pathParts[pathParts.length - 1];
  const breakdownUrl = buildBreakdownUrl(path, extraQueryParams);

  if (breakdownUrl === currentSlug + location.search) {
    // Url did not change, don't add an event to browser history
    return;
  }

  locationService.push(breakdownUrl);
}

export function buildBreakdownUrl(path: PageSlugs | string, extraQueryParams?: UrlQueryMap): string {
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

export function getSlug() {
  const location = locationService.getLocation();
  const slug = location.pathname.slice(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
  return slug as PageSlugs;
}

export function extractServiceFromRoute(routeMatch: SceneRouteMatch<{ service: string }>): { service: string } {
  const service = routeMatch.params.service;
  return { service };
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
