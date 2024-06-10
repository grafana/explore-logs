import React from 'react';

import { PanelBuilders, SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR } from 'services/variables';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
}

export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  constructor(state: LogsVolumePanelState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }
  }

  private getVizPanel() {
    return PanelBuilders.timeseries()
      .setTitle('Log volume')
      .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
      .setUnit('short')
      .setData(
        getQueryRunner(
          buildLokiQuery(
            `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto]))`,
            { legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}` }
          )
        )
      )
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
