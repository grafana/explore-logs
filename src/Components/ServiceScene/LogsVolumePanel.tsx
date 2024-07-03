import React from 'react';

import { doStandardCalcs, LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR } from 'services/variables';
import { ServiceScene } from './ServiceScene';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
  totalLogCount?: number;
}

export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  constructor(state: LogsVolumePanelState) {
    super({
      $data: getQueryRunner(
        buildLokiQuery(
          `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto]))`,
          { legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}` }
        )
      ),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (!this.state.panel) {
      this.state.$data?.getResultsStream().subscribe((data) => {
        if (data.data.state === LoadingState.Done) {
          // once we have the log volume, calculate the total number of logs
          const fieldCalcs = data.data.series.map((dataFrame) => ({
            value: doStandardCalcs(dataFrame.fields[1], true, true),
            frame: dataFrame,
          }));
          const totalLogs = fieldCalcs.reduce((acc, { value, frame }) => {
            acc += value.sum;
            return acc;
          }, 0);

          const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
          serviceScene.setState({
            logsCount: totalLogs,
          });
        }
      });

      const panel = this.getVizPanel();

      this.setState({
        panel,
      });
    }
  }

  private getVizPanel() {
    return PanelBuilders.timeseries()
      .setTitle('Log volume')
      .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
      .setUnit('short')
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLeverColorOverrides)
      .build();
  }

  public static Component = ({ model }: SceneComponentProps<LogsVolumePanel>) => {
    const { panel } = model.useState();
    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}
