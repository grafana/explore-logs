import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ALL_VARIABLE_VALUE } from './variables';
import { getMetadataService } from './metadata';
import { locationService } from '@grafana/runtime';
import {
  buildServicesUrl,
  DRILLDOWN_URL_KEYS,
  PageSlugs,
  prefixRoute,
  replaceSlash,
  ROUTES,
  ValueSlugs,
} from './routing';
import { sceneGraph } from '@grafana/scenes';
import { UrlQueryMap, urlUtil } from '@grafana/data';

function buildValueBreakdownUrl(label: string, newPath: ValueSlugs, serviceString: string) {
  if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.label) {
    return prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(serviceString)}/${PageSlugs.labels}`);
  } else if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.field) {
    return prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(serviceString)}/${PageSlugs.fields}`);
  } else {
    return prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(serviceString)}/${newPath}/${replaceSlash(label)}`);
  }
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

/**
 * Navigate to value breakdown url
 * @param newPath
 * @param label
 * @param serviceScene
 */
export function navigateToValueBreakdown(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);

  if (indexScene) {
    const serviceString = indexScene.state.routeMatch?.params.service;
    if (serviceString) {
      let urlPath = buildValueBreakdownUrl(label, newPath, serviceString);
      const fullUrl = buildBreakdownUrl(urlPath);

      // If we're going to navigate, we need to share the state between this instantiation of the service scene
      if (serviceScene) {
        const metadataService = getMetadataService();
        metadataService.setServiceSceneState(serviceScene.state);
      }

      locationService.push(fullUrl);
      return;
    }
  }

  console.warn('no navigate?');
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
  if (serviceScene) {
    const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
    const serviceString = indexScene.state.routeMatch?.params.service;

    if (serviceString) {
      const fullUrl = prefixRoute(`${PageSlugs.explore}/service/${replaceSlash(serviceString)}/${path}`);
      const breakdownUrl = buildBreakdownUrl(fullUrl, extraQueryParams);

      // If we're going to navigate, we need to share the state between this instantiation of the service scene
      if (serviceScene) {
        const metadataService = getMetadataService();
        metadataService.setServiceSceneState(serviceScene.state);
      }

      locationService.push(breakdownUrl);
      return;
    }
  } else {
    const breakdownUrl = buildBreakdownUrl(path, extraQueryParams);
    locationService.push(breakdownUrl);
  }
}

/**
 * Navigate to the services selection url
 */
export function navigateToIndex() {
  const location = locationService.getLocation();
  const serviceUrl = buildServicesUrl(ROUTES.explore());
  const currentUrl = location.pathname + location.search;

  if (serviceUrl === currentUrl) {
    return;
  }

  locationService.push(serviceUrl);
}
