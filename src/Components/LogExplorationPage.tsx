import React, { useEffect } from 'react';

import { EmbeddedScene, getUrlSyncManager, SceneApp, SceneAppPage, SceneTimeRange, useSceneApp } from '@grafana/scenes';
import { IndexScene } from './IndexScene/IndexScene';
import { EXPLORATIONS_ROUTE, ROUTES } from '../services/routing';
import { PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Redirect } from 'react-router-dom';
import { makeRedirectPage } from './Pages';

const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

function makeIndexPage() {
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

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeRedirectPage(ROUTES.Explore)],
  });

export function LogExplorationView() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  // useSceneApp always fails to cache, the entire app is being re-instantiated on every change to the url params
  const scene = useSceneApp(getSceneApp);

  useEffect(() => {
    if (!isInitialized) {
      getUrlSyncManager().initSync(scene);
      setIsInitialized(true);
    }
  }, [scene, isInitialized]);

  const userPermissions = config.bootData.user.permissions;
  const canUseApp = userPermissions?.['grafana-lokiexplore-app:read'] || userPermissions?.['datasources:explore'];
  if (!canUseApp) {
    return <Redirect to="/" />;
  }

  if (!isInitialized) {
    return null;
  }

  return <scene.Component model={scene} />;
}
