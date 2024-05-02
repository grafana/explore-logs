import React, { useEffect, useState } from 'react';

import { getUrlSyncManager } from '@grafana/scenes';
import { newLogsExploration } from 'services/scenes';
import { IndexScene } from 'Components/IndexScene/IndexScene';

export const LogExplorationPage = () => {
  const [exploration] = useState(newLogsExploration());

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
