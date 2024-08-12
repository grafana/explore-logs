import React from 'react';

import { PanelBuilders, SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelSeriesOverrides, setLeverColorOverrides } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { getAdHocFiltersVariable, getLabelsVariable, LEVEL_VARIABLE_VALUE, VAR_LEVELS } from 'services/variables';
import { addToFilters, replaceFilter } from './Breakdowns/AddToFiltersButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';
import { SERVICE_NAME } from '../ServiceSelectionScene/ServiceSelectionScene';
import { getVisibleLevels } from 'services/levels';
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

    const levelFilter = getAdHocFiltersVariable(VAR_LEVELS, this);
    if (levelFilter) {
      this._subs.add(
        levelFilter?.subscribeToState((newState, prevState) => {
          const prevLevels = prevState.filters
            .filter((filter) => filter.operator === FilterOp.Equal)
            .map((filter) => filter.value);
          const newLevels = newState.filters
            .filter((filter) => filter.operator === FilterOp.Equal)
            .map((filter) => filter.value);
          prevLevels.forEach((prevLevel) => {
            if (!newLevels.includes(prevLevel)) {
              // prevLevel was removed, toggle
              originalOnToggleSeriesVisibility?.(prevLevel, SeriesVisibilityChangeMode.ToggleSelection);
            }
          });
          newLevels.forEach((newLevel) => {
            if (!prevLevels.includes(newLevel)) {
              // newLevel is new, toggle
              originalOnToggleSeriesVisibility?.(newLevel, SeriesVisibilityChangeMode.ToggleSelection);
            }
          });
        })
      );
    }

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      // @TODO. We don't yet support filters with multiple values.
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        return;
      }

      const levelFilter = getAdHocFiltersVariable(VAR_LEVELS, this);
      const empty = levelFilter.state.filters.length === 0;
      const filterExists = levelFilter.state.filters.find(
        (filter) => filter.value === level && filter.operator === FilterOp.Equal
      );
      let action;
      if (empty || !filterExists) {
        replaceFilter(LEVEL_VARIABLE_VALUE, level, 'include', this);
        action = 'add';
      } else {
        addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', this);
        action = 'remove';
      }

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
