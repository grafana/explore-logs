import React from 'react';
import { AppRootProps } from '@grafana/data';
import { LogExplorationView } from './LogExplorationPage';

const PluginPropsContext = React.createContext<AppRootProps | null>(null);

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <PluginPropsContext.Provider value={this.props}>
        <LogExplorationView />
      </PluginPropsContext.Provider>
    );
  }
}
