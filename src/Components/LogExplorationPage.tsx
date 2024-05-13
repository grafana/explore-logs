import React from 'react';

import { EmbeddedScene, SceneApp, SceneAppPage, SceneTimeRange, useSceneApp } from '@grafana/scenes';
import { IndexScene } from './IndexScene/IndexScene';
import { prefixRoute, ROUTES } from '../services/routing';

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

const myAppPage = new SceneAppPage({
  title: 'Logs',
  renderTitle: () => undefined,
  url: prefixRoute(ROUTES.Explore),
  getScene: (routeMatch) =>
    new EmbeddedScene({
      body: new IndexScene({
        $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
      }),
    }),
});

export function ExploreLogsApp() {
  const scene = useSceneApp(getExploreLogsApp);

  return <scene.Component model={scene} />;
}

function getExploreLogsApp() {
  return new SceneApp({
    pages: [myAppPage],
  });
}
