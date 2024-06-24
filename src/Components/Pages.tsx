import { EmbeddedScene, SceneAppPage, SceneFlexLayout, SceneRouteMatch, SceneTimeRange } from '@grafana/scenes';
import { EXPLORATIONS_ROUTE, PLUGIN_BASE_URL, prefixRoute, ROUTES } from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { IndexScene } from './IndexScene/IndexScene';
import { locationService } from '@grafana/runtime';

// Index page
export function makeIndexPage() {
  const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

  return new SceneAppPage({
    // Top level breadcrumb
    title: 'Logs',
    url: EXPLORATIONS_ROUTE,
    layout: PageLayoutType.Custom,
    getScene: () =>
      new EmbeddedScene({
        body: new IndexScene({
          $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
        }),
      }),
  });
}

// Redirect page
export function makeRedirectPage(to: ROUTES) {
  return new SceneAppPage({
    title: '',
    url: PLUGIN_BASE_URL,
    getScene: makeEmptyScene(),
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
