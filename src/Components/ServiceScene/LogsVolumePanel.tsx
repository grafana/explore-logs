import React from 'react';

import { PanelBuilders, SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelSeriesOverrides, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { getAdHocFiltersVariable, getLabelsVariable, LEVEL_VARIABLE_VALUE, VAR_LEVELS } from 'services/variables';
import { addToFilters, replaceFilter } from './Breakdowns/AddToFiltersButton';
import { getTimeSeriesExpr } from '../../services/expressions';
import { SERVICE_NAME } from '../ServiceSelectionScene/ServiceSelectionScene';

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
        getQueryRunner(
          buildLokiQuery(getTimeSeriesExpr(this, LEVEL_VARIABLE_VALUE, false), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
          })
        )
      )
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLeverColorOverrides);

    const fieldFilters = getAdHocFiltersVariable(VAR_LEVELS, this);
    const filteredLevels = fieldFilters?.state.filters.map((filter) => filter.value);
    if (filteredLevels?.length) {
      viz.setOverrides(setLevelSeriesOverrides.bind(null, filteredLevels));
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
          const hadLevel = prevState.filters.find((filter) => filter.key === LEVEL_VARIABLE_VALUE);
          const removedLevel = newState.filters.findIndex((filter) => filter.key === LEVEL_VARIABLE_VALUE) < 0;
          if (hadLevel && removedLevel) {
            originalOnToggleSeriesVisibility?.(hadLevel.value, SeriesVisibilityChangeMode.ToggleSelection);
          }
          const addedLevel = newState.filters.find((filter) => filter.key === LEVEL_VARIABLE_VALUE);
          if (addedLevel) {
            originalOnToggleSeriesVisibility?.(addedLevel.value, SeriesVisibilityChangeMode.ToggleSelection);
          }
        })
      );
    }

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      // @TODO. We don't yet support filters with multiple values.
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        return;
      }

      const levelFilter = getAdHocFiltersVariable(VAR_LEVELS, this);
      if (!levelFilter) {
        return;
      }
      const hadLevel = levelFilter.state.filters.find(
        (filter) => filter.key === LEVEL_VARIABLE_VALUE && filter.value !== level
      );
      if (hadLevel) {
        replaceFilter(LEVEL_VARIABLE_VALUE, level, 'include', this);
      } else {
        addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', this);
      }
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
