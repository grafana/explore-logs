import React from 'react';

import { PanelBuilders, SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelSeriesOverrides, setLeverColorOverrides } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { getLabelsVariable, getLevelsVariable, LEVEL_VARIABLE_VALUE } from 'services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';
import { SERVICE_NAME } from '../ServiceSelectionScene/ServiceSelectionScene';
import { getVisibleLevels, toggleLevelFromLogsVolume } from 'services/levels';
import { FilterOp } from 'services/filters';

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

    const labels = getLabelsVariable(this);

    labels.subscribeToState((newState, prevState) => {
      const newService = newState.filters.find((f) => f.key === SERVICE_NAME);
      const prevService = prevState.filters.find((f) => f.key === SERVICE_NAME);
      if (newService !== prevService) {
        this.setState({
          panel: this.getVizPanel(),
        });
      }
    });
  }

  private getVizPanel() {
    const viz = PanelBuilders.timeseries()
      .setTitle('Log volume')
      .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
      .setUnit('short')
      .setData(
        getQueryRunner([
          buildDataQuery(getTimeSeriesExpr(this, LEVEL_VARIABLE_VALUE, false), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
          }),
        ])
      )
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLeverColorOverrides);

    const focusedLevels = getVisibleLevels(this);
    if (focusedLevels?.length) {
      viz.setOverrides(setLevelSeriesOverrides.bind(null, focusedLevels));
    }

    const panel = viz.build();
    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

    return panel;
  }

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    const levelFilter = getLevelsVariable(this);
    if (levelFilter) {
      this._subs.add(
        levelFilter?.subscribeToState((newState, prevState) => {
          const oldLevel = prevState.filters.find((filter) => filter.operator === FilterOp.Equal);
          const newLevel = newState.filters.find((filter) => filter.operator === FilterOp.Equal);
          if (newLevel) {
            originalOnToggleSeriesVisibility?.(newLevel.value, SeriesVisibilityChangeMode.ToggleSelection);
          } else if (oldLevel) {
            originalOnToggleSeriesVisibility?.(oldLevel.value, SeriesVisibilityChangeMode.ToggleSelection);
          }
        })
      );
    }

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      // @TODO. We don't yet support filters with multiple values.
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        return;
      }

      const action = toggleLevelFromLogsVolume(level, this);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.level_in_logs_volume_clicked,
        {
          level,
          action,
        }
      );
    };
  };

  public static Component = ({ model }: SceneComponentProps<LogsVolumePanel>) => {
    const { panel } = model.useState();
    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}
