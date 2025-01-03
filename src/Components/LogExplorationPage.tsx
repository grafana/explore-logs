import React, { useEffect } from 'react';

import { SceneApp, useSceneApp } from '@grafana/scenes';
import { config } from '@grafana/runtime';
import { Redirect } from 'react-router-dom';
import { makeIndexPage, makeRedirectPage } from './Pages';
import { initializeMetadataService } from '../services/metadata';

const getSceneApp = () =>
  new SceneApp({
    pages: [makeIndexPage(), makeRedirectPage()],
    urlSyncOptions: {
      createBrowserHistorySteps: false,
      updateUrlOnInit: true,
    },
  });

function LogExplorationView() {
  const [isInitialized, setIsInitialized] = React.useState(false);

  initializeMetadataService();

  const scene = useSceneApp(getSceneApp);

  useEffect(() => {
    if (!isInitialized) {
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

export default LogExplorationView;
