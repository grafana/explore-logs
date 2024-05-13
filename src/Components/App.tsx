import React from 'react';
import { AppRootProps } from '@grafana/data';
import { ExploreLogsApp } from './LogExplorationPage';

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return <ExploreLogsApp />;
  }
}
