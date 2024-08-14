import React from 'react';

import {
  FieldConfigBuilder,
  FieldConfigBuilders,
  PanelBuilders,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode } from '@grafana/ui';
import { getQueryRunner, setLevelSeriesOverrides, setLogsVolumeFieldConfigs } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { getLabelsVariable, getLevelsVariable, LEVEL_VARIABLE_VALUE } from 'services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';
import { SERVICE_NAME } from '../ServiceSelectionScene/ServiceSelectionScene';
import { getLabelsFromSeries, getVisibleLevels, toggleLevelFromFilter } from 'services/levels';
import { FilterOp } from 'services/filters';
import { LoadingState } from '@grafana/data';

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
      );

    setLogsVolumeFieldConfigs(viz);

    const panel = viz.build();
    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

    this._subs.add(
      panel.state.$data?.subscribeToState((newState) => {
        if (newState.data?.state !== LoadingState.Done) {
          return;
        }
        const focusedLevels = getVisibleLevels(getLabelsFromSeries(newState.data.series), this);
        if (focusedLevels?.length) {
          const config = setLogsVolumeFieldConfigs(FieldConfigBuilders.timeseries()).setOverrides(
            setLevelSeriesOverrides.bind(null, focusedLevels)
          );
          if (config instanceof FieldConfigBuilder) {
            panel.onFieldConfigChange(config.build(), true);
          }
        }
      })
    );

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

          if (oldLevel === newLevel) {
            return;
          }

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

      const action = toggleLevelFromFilter(level, this);

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
