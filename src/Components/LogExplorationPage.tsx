import React, { useEffect } from 'react';

import { getUrlSyncManager, SceneApp, useSceneApp } from '@grafana/scenes';
import { config } from '@grafana/runtime';
import { Redirect } from 'react-router-dom';
import { makeIndexPage, makeRedirectPage } from './Pages';
import { SLUGS } from '../services/routing';

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeRedirectPage(SLUGS.explore)],
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
