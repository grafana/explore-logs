import React, { useEffect, useState } from 'react';

import { getUrlSyncManager } from '@grafana/scenes';
import { MainComponent } from '../../components/Main/MainComponent';
import { newLogsExploration } from 'utils/utils';

export const LogExplorationPage = () => {
  const [exploration] = useState(newLogsExploration());

  return <LogExplorationView exploration={exploration} />;
};

function LogExplorationView({ exploration }: { exploration: MainComponent }) {
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
