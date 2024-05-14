import React, { useEffect, useMemo } from 'react';

import { SceneTimeRange, getUrlSyncManager } from '@grafana/scenes';
import { IndexScene } from './IndexScene/IndexScene';
const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

export function LogExplorationView() {
  const [isInitialized, setIsInitialized] = React.useState(false);
  // Must memoize the top-level scene or any route change will re-instantiate all the scene classes
  const scene = useMemo(
    () =>
      new IndexScene({
        $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
      }),
    []
  );

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
