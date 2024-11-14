import React from 'react';

import { PanelBuilders, SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, useStyles2 } from '@grafana/ui';
import { getQueryRunner, setLogsVolumeFieldConfigs, syncLogsPanelVisibleSeries } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';
import { toggleLevelFromFilter } from 'services/levels';
import { LoadingState } from '@grafana/data';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable } from '../../services/variableGetters';
import { areArraysEqual } from '../../services/comparison';
import { ExploreLogsVizPanelMenu, getPanelWrapperStyles } from '../Panels/ExploreLogsVizPanelMenu';

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
    const fields = getFieldsVariable(this);

    labels.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.setState({
          panel: this.getVizPanel(),
        });
      }
    });

    fields.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
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
      .setMenu(new ExploreLogsVizPanelMenu({}))
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

        syncLogsPanelVisibleSeries(panel, newState.data.series, this);
      })
    );

    return panel;
  }

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const levelFilter = getLevelsVariable(this);
    this._subs.add(
      levelFilter?.subscribeToState(() => {
        const panel = this.state.panel;
        if (!panel?.state.$data?.state.data?.series) {
          return;
        }

        syncLogsPanelVisibleSeries(panel, panel?.state.$data?.state.data?.series, this);
      })
    );

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
    const styles = useStyles2(getPanelWrapperStyles);

    return (
      <span className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </span>
    );
  };
}
