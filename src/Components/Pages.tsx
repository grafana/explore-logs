import {
  EmbeddedScene,
  SceneAppPage,
  SceneAppPageLike,
  SceneFlexLayout,
  SceneRouteMatch,
  SceneTimeRange,
} from '@grafana/scenes';
import {
  DRILLDOWN_URL_KEYS,
  PLUGIN_BASE_URL,
  prefixRoute,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  SLUGS,
} from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { IndexScene, LogExplorationMode } from './IndexScene/IndexScene';
import { locationService } from '@grafana/runtime';

function getServicesScene(mode: LogExplorationMode, actionView?: SLUGS) {
  const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
  return new EmbeddedScene({
    body: new IndexScene({
      $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
      mode,
      breakdownView: actionView,
    }),
  });
}

// Index page
export function makeIndexPage() {
  return new SceneAppPage({
    // Top level breadcrumb
    title: 'Logs',
    url: prefixRoute(SLUGS.explore),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: SERVICE_URL_KEYS,
    routePath: prefixRoute(SLUGS.explore),
    getScene: () => getServicesScene('service_selection'),
    drilldowns: [
      {
        routePath: ROUTE_DEFINITIONS.logs,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, SLUGS.logs),
      },
      {
        routePath: ROUTE_DEFINITIONS.labels,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, SLUGS.labels),
      },
      {
        routePath: ROUTE_DEFINITIONS.patterns,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, SLUGS.patterns),
      },
      {
        routePath: ROUTE_DEFINITIONS.fields,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, SLUGS.fields),
      },
    ],
  });
}

// Redirect page
export function makeRedirectPage(to: SLUGS) {
  return new SceneAppPage({
    title: '',
    url: PLUGIN_BASE_URL,
    getScene: makeEmptyScene(),
    preserveUrlKeys: SERVICE_URL_KEYS,
    hideFromBreadcrumbs: true,
    $behaviors: [
      () => {
        locationService.push(prefixRoute(to));
      },
    ],
  });
}

function makeEmptyScene(): (routeMatch: SceneRouteMatch) => EmbeddedScene {
  return () =>
    new EmbeddedScene({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
    });
}

export function makeBreakdownPage(
  routeMatch: SceneRouteMatch<{ service: string }>,
  parent: SceneAppPageLike,
  slug: SLUGS
): SceneAppPage {
  const { service } = extractServiceFromRoute(routeMatch);
  return new SceneAppPage({
    title: slug,
    layout: PageLayoutType.Custom,
    url: ROUTES[slug](service),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: () => getServicesScene('service_details', slug),
  });
}

export function getSlug() {
  const location = locationService.getLocation();
  const slug = location.pathname.slice(location.pathname.lastIndexOf('/') + 1, location.pathname.length);
  return slug as SLUGS;
}

export function extractServiceFromRoute(routeMatch: SceneRouteMatch<{ service: string }>): { service: string } {
  const service = routeMatch.params.service;
  return { service };
}
