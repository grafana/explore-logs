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
  DRILLDOWN_URL_KEYS,
  extractValuesFromRoute,
  PageSlugs,
  ParentDrilldownSlugs,
  PLUGIN_BASE_URL,
  prefixRoute,
  ROUTE_DEFINITIONS,
  ROUTES,
  SERVICE_URL_KEYS,
  SUB_ROUTES,
  ValueSlugs,
} from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { IndexScene } from './IndexScene/IndexScene';
import { navigateToIndex } from '../services/navigate';
import { logger } from '../services/logger';

export type RouteProps = { labelName: string; labelValue: string; breakdownLabel?: string };
export type RouteMatch = SceneRouteMatch<RouteProps>;
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type OptionalRouteProps = Optional<RouteProps, 'labelName' | 'labelValue'>;
export type OptionalRouteMatch = SceneRouteMatch<OptionalRouteProps>;

function getServicesScene(routeMatch: OptionalRouteMatch) {
  console.log('getServicesScene', routeMatch);
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
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.logs),
        defaultRoute: true,
      },
      {
        routePath: ROUTE_DEFINITIONS.labels,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.labels),
      },
      {
        routePath: ROUTE_DEFINITIONS.patterns,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.patterns),
      },
      {
        routePath: ROUTE_DEFINITIONS.fields,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownPage(routeMatch, parent, PageSlugs.fields),
      },
      {
        routePath: CHILD_ROUTE_DEFINITIONS.label,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.label),
      },
      {
        routePath: CHILD_ROUTE_DEFINITIONS.field,
        getPage: (routeMatch: RouteMatch, parent) => makeBreakdownValuePage(routeMatch, parent, ValueSlugs.field),
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
  routeMatch: RouteMatch,
  parent: SceneAppPageLike,
  slug: ParentDrilldownSlugs
): SceneAppPage {
  const { labelName, labelValue } = extractValuesFromRoute(routeMatch);
  console.log('makeBreakdownPage', {
    routeMatch,
    parent,
    slug,
    labelName,
  });
  return new SceneAppPage({
    title: slugToBreadcrumbTitle(slug),
    layout: PageLayoutType.Custom,
    url: ROUTES[slug](labelValue, labelName),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}

export function makeBreakdownValuePage(
  routeMatch: RouteMatch,
  parent: SceneAppPageLike,
  slug: ChildDrilldownSlugs
): SceneAppPage {
  console.log('makeBreakdownValuePage', {
    routeMatch,
    parent,
    slug,
  });
  const { labelName, labelValue, breakdownLabel } = extractValuesFromRoute(routeMatch);

  if (!breakdownLabel) {
    const e = new Error('Breakdown value missing!');
    logger.error(e, { labelName, labelValue, breakdownLabel: breakdownLabel ?? '' });
    throw e;
  }

  return new SceneAppPage({
    title: slugToBreadcrumbTitle(breakdownLabel),
    layout: PageLayoutType.Custom,
    url: SUB_ROUTES[slug](labelValue, labelName, breakdownLabel),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}

function slugToBreadcrumbTitle(slug: string) {
  // capitalize first letter
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
