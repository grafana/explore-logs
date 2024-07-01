import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps, sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  VizPanelState
} from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR } from 'services/variables';
import {LogsListScene} from "./LogsListScene";

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
  collapsed: boolean,
}

export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  constructor(state: LogsVolumePanelState) {
    super({
      ...state,
      collapsed: state.collapsed,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }

    this.subscribeToState((newState, prevState) => {
      if(newState.collapsed !== prevState.collapsed){
        this.setState({
          panel: this.getVizPanel(),
        });
      }
    })
  }

  private getVizPanel() {
    const panel = PanelBuilders.timeseries()
        .setPanelChromeProps({
          collapsed: this.state.collapsed,
          collapsible: true,
          height: this.state.collapsed ? 32 : 200,
          onToggleCollapse: () => {
            console.log('onToggleCollapse state', this.state.collapsed)
            const logsListScene = sceneGraph.getAncestor(this, LogsListScene)
            logsListScene.setState({
              collapsed: !this.state.collapsed
            })
          }
        })
        .setTitle('Log volume')
        .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
        .setUnit('short')
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
        .setOverrides(setLeverColorOverrides)

    // Don't run query if collapsed
    if(!this.state.collapsed){
      panel.setData(
          getQueryRunner(
              buildLokiQuery(
                  `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto]))`,
                  { legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}` }
              )
          )
      )
    }

    return panel.build()
  }

  public static Component = ({ model }: SceneComponentProps<LogsVolumePanel>) => {
    const { panel, collapsed } = model.useState();
    console.log('collapsed', collapsed)
    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}
