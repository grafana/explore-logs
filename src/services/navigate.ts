import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ALL_VARIABLE_VALUE } from './variables';
import { getMetadataService } from './metadata';
import { locationService } from '@grafana/runtime';
import { buildServicesUrl, DRILLDOWN_URL_KEYS, PageSlugs, ROUTES, ValueSlugs } from './routing';
import { sceneGraph } from '@grafana/scenes';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import { replaceSlash } from './extensions/links';
import { prefixRoute } from './plugin';

let previousRoute: string | undefined = undefined;

function buildValueBreakdownUrl(label: string, newPath: ValueSlugs, labelValue: string, labelName = 'service') {
  if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.label) {
    return prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.labels}`);
  } else if (label === ALL_VARIABLE_VALUE && newPath === ValueSlugs.field) {
    return prefixRoute(`${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${PageSlugs.fields}`);
  } else {
    return prefixRoute(
      `${PageSlugs.explore}/${labelName}/${replaceSlash(labelValue)}/${newPath}/${replaceSlash(label)}`
    );
  }
}

export function buildDrilldownPageUrl(path: PageSlugs | string, extraQueryParams?: UrlQueryMap): string {
  return urlUtil.renderUrl(path, buildDrilldownPageRoute(extraQueryParams));
}

export function buildDrilldownPageRoute(extraQueryParams?: UrlQueryMap): UrlQueryMap {
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

export function getValueBreakdownLink(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const urlLabelName = indexScene.state.routeMatch?.params.labelName;
  const urlLabelValue = indexScene.state.routeMatch?.params.labelValue;

  if (urlLabelName && urlLabelValue) {
    let urlPath = buildValueBreakdownUrl(label, newPath, urlLabelValue, urlLabelName);
    const fullUrl = buildDrilldownPageUrl(urlPath);

    // If we're going to navigate, we need to share the state between this instantiation of the service scene
    if (serviceScene) {
      const metadataService = getMetadataService();
      metadataService.setServiceSceneState(serviceScene.state);
    }

    return fullUrl;
  }

  return '';
}

/**
 * Navigate to value breakdown url
 * @param newPath
 * @param label
 * @param serviceScene
 */
export function navigateToValueBreakdown(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const link = getValueBreakdownLink(newPath, label, serviceScene);
  if (link) {
    pushUrlHandler(link);
  }
}

/**
 * The case for initial navigation from the service selection to the service index is a special case, as we don't yet have a serviceScene constructed to pull the selected service.
 * This function will route users to the initial (logs) page from the service selection view, which will populate the service scene state with the selected service string.
 * @param labelName
 * @param labelValue
 */
export function getDrillDownIndexLink(labelName: string, labelValue: string, labelFilters?: UrlQueryMap) {
  const breakdownUrl = buildDrilldownPageUrl(ROUTES.logs(labelValue, labelName), labelFilters);
  return breakdownUrl;
}

export function getDrillDownTabLink(path: PageSlugs, serviceScene: ServiceScene, extraQueryParams?: UrlQueryMap) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const urlLabelValue = indexScene.state.routeMatch?.params.labelValue;
  const urlLabelName = indexScene.state.routeMatch?.params.labelName;

  if (urlLabelValue) {
    const fullUrl = prefixRoute(`${PageSlugs.explore}/${urlLabelName}/${replaceSlash(urlLabelValue)}/${path}`);
    return buildDrilldownPageUrl(fullUrl, extraQueryParams);
  }
  return '';
}

/**
 * Navigates to the drilldown page specified by the path slug
 *
 * @param path
 * @param serviceScene
 * @param extraQueryParams
 */
export function navigateToDrilldownPage(path: PageSlugs, serviceScene: ServiceScene, extraQueryParams?: UrlQueryMap) {
  const drilldownLink = getDrillDownTabLink(path, serviceScene, extraQueryParams);

  if (drilldownLink) {
    // If we're going to navigate, we need to share the state between this instantiation of the service scene
    if (serviceScene) {
      const metadataService = getMetadataService();
      metadataService.setServiceSceneState(serviceScene.state);
    }

    pushUrlHandler(drilldownLink);
    return;
  }
}

export function pushUrlHandler(newUrl: string) {
  previousRoute = newUrl;
  locationService.push(newUrl);
}

export function addCurrentUrlToHistory() {
  // Add the current url to browser history before the state is changed so the user can revert their change.
  const location = locationService.getLocation();
  locationService.push(location.pathname + location.search);
}

/**
 * Navigate to the services selection url
 */
export function navigateToIndex() {
  const location = locationService.getLocation();
  const serviceUrl = buildServicesUrl(ROUTES.explore());
  const currentUrl = location.pathname + location.search;
  const search = locationService.getSearch();

  if (serviceUrl === currentUrl || currentUrl.includes(serviceUrl)) {
    return;
  }

  if (!search.get('var-filters')) {
    // If we don't have filters, we don't want to keep this url in browser history since this is fired AFTER the url props are made invalid, push the previous route and replace it
    if (previousRoute) {
      locationService.replace(previousRoute);
    }
    locationService.push(serviceUrl);
  } else {
    pushUrlHandler(serviceUrl);
  }
}
