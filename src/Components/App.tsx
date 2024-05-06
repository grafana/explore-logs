import React from 'react';
import { AppRootProps } from '@grafana/data';
import { Routes } from './Routes';
import { sceneUtils } from '@grafana/scenes';
import { LOGS_TABLE_PLUGIN_ID } from './Table/tablePanel';
import { customTablePanel } from './Table/registerTable';

// @todo where to register custom panels?
sceneUtils.registerRuntimePanelPlugin({ pluginId: LOGS_TABLE_PLUGIN_ID, plugin: customTablePanel });

export class App extends React.PureComponent<AppRootProps> {
  render() {
    return <Routes />;
  }
}
