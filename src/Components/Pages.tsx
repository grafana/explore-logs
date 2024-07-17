import {
  EmbeddedScene,
  SceneAppPage,
  SceneAppPageLike,
  SceneFlexLayout,
  SceneRouteMatch,
  SceneTimeRange,
} from '@grafana/scenes';
import {
  CHILD_ROUTE_DEFINITIONS,
  ChildDrilldownSlugs,
  ValueSlugs,
  DRILLDOWN_URL_KEYS,
  extractLabelNameFromRoute,
  extractServiceFromRoute,
  PageSlugs,
  ParentDrilldownSlugs,
  PLUGIN_BASE_URL,
  prefixRoute,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  SUB_ROUTES,
} from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { IndexScene } from './IndexScene/IndexScene';
import { navigateToIndex } from '../services/navigate';

function getServicesScene(routeMatch?: SceneRouteMatch<{ service?: string; label?: string }>) {
  const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
  return new EmbeddedScene({
    body: new IndexScene({
      $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
      routeMatch,
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
    getScene: (routeMatch) => getServicesScene(routeMatch),
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
        routePath: CHILD_ROUTE_DEFINITIONS.label,
        getPage: (routeMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.label),
      },
      {
        routePath: CHILD_ROUTE_DEFINITIONS.field,
        getPage: (routeMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.field),
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
  routeMatch: SceneRouteMatch<{ service: string; label?: string }>,
  parent: SceneAppPageLike,
  slug: ParentDrilldownSlugs
): SceneAppPage {
  const { service } = extractServiceFromRoute(routeMatch);
  return new SceneAppPage({
    title: slugToBreadcrumbTitle(slug),
    layout: PageLayoutType.Custom,
    url: ROUTES[slug](service),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}

export function makeBreakdownValuePage(
  routeMatch: SceneRouteMatch<{ service: string; label: string }>,
  parent: SceneAppPageLike,
  slug: ChildDrilldownSlugs
): SceneAppPage {
  const { service } = extractServiceFromRoute(routeMatch);
  const { label } = extractLabelNameFromRoute(routeMatch);

  return new SceneAppPage({
    title: slugToBreadcrumbTitle(label),
    layout: PageLayoutType.Custom,
    url: SUB_ROUTES[slug](service, label),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}

function slugToBreadcrumbTitle(slug: string) {
  // capitalize first letter
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
