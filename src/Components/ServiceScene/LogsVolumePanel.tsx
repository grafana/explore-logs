import React from 'react';

import {
  AdHocFiltersVariable,
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelSeriesOverrides, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import {
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS,
  VAR_LEVELS,
  VAR_LABELS,
  VAR_LINE_FILTER,
  VAR_PATTERNS,
  SERVICE_NAME,
  getAdHocFiltersVariable,
} from 'services/variables';
import { addToFilters, replaceFilter } from './Breakdowns/AddToFiltersButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
  filter?: AdHocFiltersVariable;
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

    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this) as AdHocFiltersVariable;
    const patterns = sceneGraph.lookupVariable(VAR_PATTERNS, this) as CustomVariable;
    const lineFilter = sceneGraph.lookupVariable(VAR_LINE_FILTER, this) as CustomVariable;
    const labels = sceneGraph.lookupVariable(VAR_LABELS, this) as AdHocFiltersVariable;

    this._subs.add(
      fields.subscribeToState((newState, prevState) => {
        if (newState.filters.length !== prevState.filters.length) {
          this.updateVolumePanel();
        }
      })
    );
    this._subs.add(
      labels.subscribeToState((newState, prevState) => {
        if (newState.filters.length !== prevState.filters.length) {
          this.updateVolumePanel();
        }

        const newService = newState.filters.find((f) => f.key === SERVICE_NAME);
        const prevService = prevState.filters.find((f) => f.key === SERVICE_NAME);
        if (newService !== prevService) {
          this.setState({
            panel: this.getVizPanel(),
          });
        }
      })
    );
    this._subs.add(
      patterns.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.updateVolumePanel();
        }
      })
    );
    this._subs.add(
      lineFilter.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.updateVolumePanel();
        }
      })
    );
  }

  public updateVolumePanel = () => {
    this.setState({
      panel: this.getVizPanel(),
    });
  };

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

  // private hasSingleServiceSelector(): boolean {
  //   const fields = sceneGraph.lookupVariable(VAR_FIELDS, this) as AdHocFiltersVariable;
  //   const patterns = sceneGraph.lookupVariable(VAR_PATTERNS, this) as CustomVariable;
  //   const lineFilter = sceneGraph.lookupVariable(VAR_LINE_FILTER, this) as CustomVariable;

  //   if (fields.state.filters.length !== 0 || patterns.state.value !== '') {
  //     return false;
  //   }

  //   const labels = sceneGraph.lookupVariable(VAR_LABELS, this) as AdHocFiltersVariable;
  //   if (labels.state.filters.length > 1) {
  //     return false;
  //   }

  //   const filter = (lineFilter.state.value as string).trim();
  //   if (labels.state.filters[0].key === SERVICE_NAME) {
  //     if (filter === '|~ `(?i)`' || !filter) {
  //       return true;
  //     }
  //   }

  //   return false;
  // }

  // private service(): string {
  //   const labels = sceneGraph.lookupVariable(VAR_LABELS, this) as AdHocFiltersVariable;
  //   const filters = labels?.state.filters ?? [];

  //   return filters.find((filter) => filter.key === SERVICE_NAME)?.value ?? '';
  // }

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
      let action;
      if (hadLevel) {
        replaceFilter(LEVEL_VARIABLE_VALUE, level, 'include', this);
        action = 'remove';
      } else {
        addToFilters(LEVEL_VARIABLE_VALUE, level, 'toggle', this);
        action = 'add';
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
