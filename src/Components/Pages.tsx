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
  extractServiceFromRoute,
  navigateToIndex,
  PLUGIN_BASE_URL,
  prefixRoute,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  PageSlugs,
} from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { IndexScene } from './IndexScene/IndexScene';

function getServicesScene() {
  const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
  return new EmbeddedScene({
    body: new IndexScene({
      $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
    }),
  });
}

// Index page
export function makeIndexPage() {
  return new SceneAppPage({
    // Top level breadcrumb
    title: 'Logs',
    url: prefixRoute(PageSlugs.explore),
    layout: PageLayoutType.Custom,
    preserveUrlKeys: SERVICE_URL_KEYS,
    routePath: prefixRoute(PageSlugs.explore),
    getScene: () => getServicesScene(),
    drilldowns: [
      {
        routePath: ROUTE_DEFINITIONS.logs,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.logs),
        defaultRoute: true,
      },
      {
        routePath: ROUTE_DEFINITIONS.labels,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.labels),
      },
      {
        routePath: ROUTE_DEFINITIONS.patterns,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.patterns),
      },
      {
        routePath: ROUTE_DEFINITIONS.fields,
        getPage: (routeMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.fields),
      },
      {
        routePath: '*',
        getPage: () => makeRedirectPage(),
      },
    ],
  });
}

// Redirect page back to index
export function makeRedirectPage() {
  return new SceneAppPage({
    title: '',
    url: PLUGIN_BASE_URL,
    getScene: makeEmptyScene(),
    hideFromBreadcrumbs: true,
    routePath: '*',
    $behaviors: [
      () => {
        navigateToIndex();
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
  slug: PageSlugs
): SceneAppPage {
  const { service } = extractServiceFromRoute(routeMatch);

  return new SceneAppPage({
    title: slugToBreadcrumbTitle(slug),
    layout: PageLayoutType.Custom,
    url: ROUTES[slug](service),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: () => getServicesScene(),
  });
}

function slugToBreadcrumbTitle(slug: PageSlugs) {
  if (slug === 'fields') {
    return 'Detected fields';
  }
  // capitalize first letter
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
