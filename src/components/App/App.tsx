import React from 'react';
import { AppRootProps } from '@grafana/data';
import { PluginPropsContext } from '../../utils/utils.plugin';
import { Routes } from '../Routes';
import { sceneUtils } from '@grafana/scenes';
import { customTablePanel } from '@/components/Explore/registry/registerTable';

sceneUtils.registerRuntimePanelPlugin({ pluginId: 'custom-table-viz', plugin: customTablePanel });

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <PluginPropsContext.Provider value={this.props}>
        <Routes />
      </PluginPropsContext.Provider>
    );
  }
}
