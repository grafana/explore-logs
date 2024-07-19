import React from 'react';

import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE, LOG_VOLUME_STREAM_SELECTOR_EXPR, VAR_LEVELS } from 'services/variables';
import { addToFilters } from './Breakdowns/AddToFiltersButton';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
}

export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  private focusedLevel = '';
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
    const panel = PanelBuilders.timeseries()
      .setTitle('Log volume')
      .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
      .setUnit('short')
      .setData(
        getQueryRunner(
          buildLokiQuery(
            `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time(${LOG_VOLUME_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto]))`,
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

    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

    return panel;
  }

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    const fieldFilters = sceneGraph.lookupVariable(VAR_LEVELS, this);
    if (fieldFilters instanceof AdHocFiltersVariable) {
      fieldFilters?.subscribeToState((newState, prevState) => {
        const hadLevel = prevState.filters.find((filter) => filter.key === LEVEL_VARIABLE_VALUE);
        const removedLevel = newState.filters.findIndex((filter) => filter.key === LEVEL_VARIABLE_VALUE) < 0;
        if (hadLevel && removedLevel) {
          originalOnToggleSeriesVisibility?.(hadLevel.value, SeriesVisibilityChangeMode.ToggleSelection);
        }
      });
    }

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(level, mode);
      // @TODO. We don't yet support filters with multiple values.
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        return;
      }
      addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', this);
      this.focusedLevel = this.focusedLevel === level ? '' : level;
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
