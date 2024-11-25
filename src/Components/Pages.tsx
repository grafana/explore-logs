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
import { capitalizeFirstLetter } from '../services/text';
import { PLUGIN_BASE_URL, prefixRoute } from '../services/plugin';

export type RouteProps = { labelName: string; labelValue: string; breakdownLabel?: string };
export type RouteMatch = SceneRouteMatch<RouteProps>;
type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type OptionalRouteProps = Optional<RouteProps, 'labelName' | 'labelValue'>;
export type OptionalRouteMatch = SceneRouteMatch<OptionalRouteProps>;

export const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };
function getServicesScene(routeMatch: OptionalRouteMatch) {
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
  return new SceneAppPage({
    title: capitalizeFirstLetter(slug),
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
  const { labelName, labelValue, breakdownLabel } = extractValuesFromRoute(routeMatch);

  if (!breakdownLabel) {
    const e = new Error('Breakdown value missing!');
    logger.error(e, {
      msg: 'makeBreakdownValuePage: Breakdown value missing!',
      labelName,
      labelValue,
      breakdownLabel: breakdownLabel ?? '',
    });
    throw e;
  }

  return new SceneAppPage({
    title: capitalizeFirstLetter(breakdownLabel),
    layout: PageLayoutType.Custom,
    url: SUB_ROUTES[slug](labelValue, labelName, breakdownLabel),
    preserveUrlKeys: DRILLDOWN_URL_KEYS,
    getParentPage: () => parent,
    getScene: (routeMatch) => getServicesScene(routeMatch),
  });
}
