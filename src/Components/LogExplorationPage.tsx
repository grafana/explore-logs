import React, { useEffect } from 'react';

import { EmbeddedScene, getUrlSyncManager, SceneApp, SceneAppPage, SceneTimeRange, useSceneApp } from '@grafana/scenes';
import { IndexScene } from './IndexScene/IndexScene';
import { EXPLORATIONS_ROUTE } from '../services/routing';
import { PageLayoutType } from '@grafana/data';

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

export function LogExplorationView() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  // useSceneApp always fails to cache, the entire app is being re-instantiated on every change to the url params
  const scene = useSceneApp(() => {
    return new SceneApp({
      pages: [
        new SceneAppPage({
          title: 'Explore logs',
          url: EXPLORATIONS_ROUTE,
          layout: PageLayoutType.Custom,
          getScene: () =>
            new EmbeddedScene({
              key: 'index-scene',
              body: new IndexScene({
                $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
              }),
            }),
        }),
      ],
    });
  });

  useEffect(() => {
    if (!isInitialized) {
      getUrlSyncManager().initSync(scene);
      setIsInitialized(true);
    }
  }, [scene, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
}
