import { ServiceScene } from '../Components/ServiceScene/ServiceScene';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ALL_VARIABLE_VALUE } from './variables';
import { getMetadataService } from './metadata';
import { locationService } from '@grafana/runtime';
import { buildServicesUrl, DRILLDOWN_URL_KEYS, PageSlugs, prefixRoute, ROUTES, ValueSlugs } from './routing';
import { sceneGraph } from '@grafana/scenes';
import { UrlQueryMap, urlUtil } from '@grafana/data';
import { replaceSlash } from './extensions/links';
import { logger } from './logger';

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

/**
 * Navigate to value breakdown url
 * @param newPath
 * @param label
 * @param serviceScene
 */
export function navigateToValueBreakdown(newPath: ValueSlugs, label: string, serviceScene: ServiceScene) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);

  if (indexScene) {
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
      console.log('fullUrl', fullUrl);

      locationService.push(fullUrl);
      return;
    } else {
      logger.warn('missing url params', {
        urlLabelName: urlLabelName ?? '',
        urlLabelValue: urlLabelValue ?? '',
      });
    }
  }
}

/**
 * The case for initial navigation from the service selection to the service index is a special case, as we don't yet have a serviceScene constructed to pull the selected service.
 * This function will route users to the initial (logs) page from the service selection view, which will populate the service scene state with the selected service string.
 * @param labelName
 * @param labelValue
 */
export function navigateToInitialPageAfterServiceSelection(labelName: string, labelValue: string) {
  const breakdownUrl = buildDrilldownPageUrl(ROUTES.logs(labelValue, labelName));
  locationService.push(breakdownUrl);
}

/**
 * Navigates to the drilldown page specified by the path slug
 *
 * @param path
 * @param serviceScene
 * @param extraQueryParams
 */
export function navigateToDrilldownPage(path: PageSlugs, serviceScene: ServiceScene, extraQueryParams?: UrlQueryMap) {
  const indexScene = sceneGraph.getAncestor(serviceScene, IndexScene);
  const urlLabelValue = indexScene.state.routeMatch?.params.labelValue;
  const urlLabelName = indexScene.state.routeMatch?.params.labelName;

  if (urlLabelValue) {
    const fullUrl = prefixRoute(`${PageSlugs.explore}/${urlLabelName}/${replaceSlash(urlLabelValue)}/${path}`);
    const breakdownUrl = buildDrilldownPageUrl(fullUrl, extraQueryParams);

    // If we're going to navigate, we need to share the state between this instantiation of the service scene
    if (serviceScene) {
      const metadataService = getMetadataService();
      metadataService.setServiceSceneState(serviceScene.state);
    }

    locationService.push(breakdownUrl);
    return;
  }
}

/**
 * Navigate to the services selection url
 */
export function navigateToIndex() {
  console.log('navigateToIndex');
  const location = locationService.getLocation();
  const serviceUrl = buildServicesUrl(ROUTES.explore());
  const currentUrl = location.pathname + location.search;

  if (serviceUrl === currentUrl) {
    return;
  }

  console.log('navigateToIndex changing to', serviceUrl, currentUrl);

  locationService.push(serviceUrl);
}
