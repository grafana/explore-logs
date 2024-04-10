import React from 'react';
import { AppRootProps } from '@grafana/data';
import { PluginPropsContext } from '../../utils/utils.plugin';
import { Routes } from '../Routes';
import { sceneUtils } from '@grafana/scenes';
import { customTablePanel } from '@/components/Explore/registry/registerTable';
import { LOGS_TABLE_PLUGIN_ID } from '@/components/Explore/panels/tablePanel';

sceneUtils.registerRuntimePanelPlugin({ pluginId: LOGS_TABLE_PLUGIN_ID, plugin: customTablePanel });

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return (
      <PluginPropsContext.Provider value={this.props}>
        <Routes />
      </PluginPropsContext.Provider>
    );
  }
}
