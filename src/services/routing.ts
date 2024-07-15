import pluginJson from '../plugin.json';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import {
  ALL_VARIABLE_VALUE,
  VAR_DATASOURCE,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from './variables';
import { locationService } from '@grafana/runtime';
import { AdHocFiltersVariable, sceneGraph, SceneRouteMatch } from '@grafana/scenes';
import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { getMetadataService } from './metadata';

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
  logs: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${PageSlugs.logs}`),
  fields: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${PageSlugs.fields}`),
  patterns: (service: string) =>
    prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${PageSlugs.patterns}`),
  labels: (service: string) => prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${PageSlugs.labels}`),
};

export const SUB_ROUTES = {
  label: (service: string, label: string) =>
    prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${ValueSlugs.label}/${label}`),
  field: (service: string, label: string) =>
    prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(service)}/${ValueSlugs.field}/${label}`),
};

export const ROUTE_DEFINITIONS: Record<keyof typeof PageSlugs, string> = {
  explore: prefixRoute(PageSlugs.explore),
  logs: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.logs}`),
  fields: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.fields}`),
  patterns: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.patterns}`),
  labels: prefixRoute(`${PageSlugs.explore}/service/:service/${PageSlugs.labels}`),
};

export const CHILD_ROUTE_DEFINITIONS: Record<keyof typeof ValueSlugs, string> = {
  field: prefixRoute(`${PageSlugs.explore}/service/:service/${ValueSlugs.field}/:field`),
  label: prefixRoute(`${PageSlugs.explore}/service/:service/${ValueSlugs.label}/:label`),
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

/**
 * Navigates to the drilldown view specified by the path slug
 * Note: If the serviceScene is not provided we assume it is not a parent of the calling class, i.e. we're navigating from the service selection view, instead of a drilldown view
 * Drilldown views should ALWAYS provide the serviceScene state
 *
 * @param path
 * @param serviceScene
 * @param extraQueryParams
 */
export function navigateToBreakdown(
  path: PageSlugs | string,
  serviceScene?: ServiceScene,
  extraQueryParams?: UrlQueryMap
) {
  const indexScene = serviceScene?.parent;

  const location = locationService.getLocation();
  const pathParts = location.pathname.split('/');
  const currentSlug = pathParts[pathParts.length - 1];

  // @todo struggling: is there a better way to get the service name to build the URL?
  if (indexScene) {
    const variable = sceneGraph.lookupVariable(VAR_LABELS, indexScene);

    if (variable instanceof AdHocFiltersVariable) {
      const serviceName = variable.state.filters.find((f) => f.key === 'service_name');

      if (serviceName) {
        const fullUrl = prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(serviceName.value)}/${path}`);
        const breakdownUrl = buildBreakdownUrl(fullUrl, extraQueryParams);

        if (breakdownUrl === currentSlug + location.search) {
          // Url did not change, don't add an event to browser history
          return;
        }

        // If we're going to navigate, we need to share the state between this instantiation of the service scene
        if (serviceScene) {
          const metadataService = getMetadataService();
          metadataService.setServiceSceneState(serviceScene.state);
        }

        locationService.push(breakdownUrl);
        return;
      }
    }
  }

  const breakdownUrl = buildBreakdownUrl(path, extraQueryParams);

  if (breakdownUrl === currentSlug + location.search) {
    // Url did not change, don't add an event to browser history
    return;
  }

  // If we're going to navigate, we need to share the state between this instantiation of the service scene
  if (serviceScene) {
    const metadataService = getMetadataService();
    metadataService.setServiceSceneState(serviceScene.state);
  }

  locationService.push(breakdownUrl);
}

export function navigateToSubBreakdown(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const indexScene = serviceScene.parent;

  // @todo struggling: is there a better way to get the service name to build the URL?
  if (indexScene) {
    const variable = sceneGraph.lookupVariable(VAR_LABELS, indexScene);

    if (variable instanceof AdHocFiltersVariable) {
      const serviceName = variable.state.filters.find((f) => f.key === 'service_name');

      if (serviceName) {
        let urlFromScratch;
        if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.label) {
          urlFromScratch = prefixRoute(
            `${PageSlugs.explore}/service/${replaceSlash(serviceName.value)}/${PageSlugs.labels}`
          );
        } else if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.field) {
          urlFromScratch = prefixRoute(
            `${PageSlugs.explore}/service/${replaceSlash(serviceName.value)}/${PageSlugs.fields}`
          );
        } else {
          urlFromScratch = prefixRoute(
            `${PageSlugs.explore}/service/${replaceSlash(serviceName.value)}/${newPath}/${replaceSlash(label)}`
          );
        }

        const fullUrl = buildSubBreakdownUrl(urlFromScratch);

        // If we're going to navigate, we need to share the state between this instantiation of the service scene
        if (serviceScene) {
          const metadataService = getMetadataService();
          metadataService.setServiceSceneState(serviceScene.state);
        }

        locationService.push(fullUrl);
        return;
      }
    }
  }
}

export function buildBreakdownUrl(path: PageSlugs | string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildBreakdownRoute(extraQueryParams));
}

export function buildSubBreakdownUrl(fullUrl: string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(`${fullUrl}`, buildSubBreakdownRoute(extraQueryParams));
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

export function buildSubBreakdownRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
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

export function getParentSlug() {
  const location = locationService.getLocation();
  const locationArray = location.pathname.split('/');
  const slug = locationArray[locationArray.length - 2];
  return slug as ValueSlugs;
}

export function extractServiceFromRoute(routeMatch: SceneRouteMatch<{ service: string }>): { service: string } {
  const service = routeMatch.params.service;
  return { service };
}

export function extractLabelNameFromRoute(routeMatch: SceneRouteMatch<{ label: string }>): { label: string } {
  const label = routeMatch.params.label;
  return { label };
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
