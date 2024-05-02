import React, { useEffect, useState } from 'react';

import { SceneTimeRange, getUrlSyncManager } from '@grafana/scenes';
import { IndexScene } from './IndexScene/IndexScene';
const DEFAULT_TIME_RANGE = { from: 'now-15m', to: 'now' };

export const LogExplorationPage = () => {
  // Here we are initializing the scene with the default time range
  const [exploration] = useState(
    new IndexScene({
      $timeRange: new SceneTimeRange(DEFAULT_TIME_RANGE),
    })
  );

  return <LogExplorationView exploration={exploration} />;
};

function LogExplorationView({ exploration }: { exploration: IndexScene }) {
  const [isInitialized, setIsInitialized] = React.useState(false);

  useEffect(() => {
    if (!isInitialized) {
      getUrlSyncManager().initSync(exploration);
      setIsInitialized(true);
    }
  }, [exploration, isInitialized]);

  if (!isInitialized) {
    return null;
  }

  return <exploration.Component model={exploration} />;
}
