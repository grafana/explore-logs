import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, useStyles2 } from '@grafana/ui';
import { getQueryRunner, setLogsVolumeFieldConfigs, syncLogsPanelVisibleSeries } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { LEVEL_VARIABLE_VALUE } from 'services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getTimeSeriesExpr } from '../../services/expressions';
import { toggleLevelFromFilter } from 'services/levels';
import { DataFrame, getValueFormat, LoadingState } from '@grafana/data';
import { getFieldsVariable, getLabelsVariable, getLevelsVariable } from '../../services/variableGetters';
import { areArraysEqual } from '../../services/comparison';
import { getPanelWrapperStyles, PanelMenu } from '../Panels/PanelMenu';
import { ServiceScene } from './ServiceScene';
import { getSeriesVisibleRange, getVisibleRangeFrame } from 'services/logsFrame';

export interface LogsVolumePanelState extends SceneObjectState {
  panel?: VizPanel;
}

export const logsVolumePanelKey = 'logs-volume-panel';
export class LogsVolumePanel extends SceneObjectBase<LogsVolumePanelState> {
  private updatedLogSeries: DataFrame[] | null = null;
  constructor(state: LogsVolumePanelState) {
    super({
      ...state,
      key: logsVolumePanelKey,
    });

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

  private getTitle(logsCount: number | undefined) {
    const valueFormatter = getValueFormat('short');
    const formattedTotalCount = logsCount !== undefined ? valueFormatter(logsCount, 0) : undefined;
    return formattedTotalCount !== undefined
      ? `Log volume (${formattedTotalCount.text}${formattedTotalCount.suffix?.trim()})`
      : 'Log volume';
  }

  private getVizPanel() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const totalLogsCount = serviceScene.state.totalLogsCount;
    const viz = PanelBuilders.timeseries()
      .setTitle(this.getTitle(totalLogsCount))
      .setOption('legend', { showLegend: true, calcs: ['sum'], displayMode: LegendDisplayMode.List })
      .setUnit('short')
      .setMenu(new PanelMenu({}))
      // 11.5
      // .setShowMenuAlways(true)
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
        if (serviceScene.state.$data?.state.data?.state === LoadingState.Done && !newState.data.annotations?.length) {
          this.updateVisibleRange(serviceScene.state.$data?.state.data?.series);
        } else {
          this.displayVisibleRange();
        }
        syncLogsPanelVisibleSeries(panel, newState.data.series, this);
      })
    );

    this._subs.add(
      serviceScene.state.$data?.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.updateVisibleRange(newState.data.series);
        }
      })
    );

    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (newState.totalLogsCount !== prevState.totalLogsCount) {
          if (!this.state.panel) {
            this.setState({
              panel: this.getVizPanel(),
            });
          } else {
            this.state.panel.setState({
              title: this.getTitle(newState.totalLogsCount),
            });
          }
        }
      })
    );

    return panel;
  }

  public updateVisibleRange(data: DataFrame[] = []) {
    this.updatedLogSeries = data;
    this.displayVisibleRange();
  }

  private displayVisibleRange() {
    const panel = this.state.panel;
    if (
      !panel ||
      !panel.state.$data?.state.data ||
      panel.state.$data?.state.data.state !== LoadingState.Done ||
      !this.updatedLogSeries
    ) {
      return;
    }
    const visibleRange = getSeriesVisibleRange(this.updatedLogSeries);
    this.updatedLogSeries = null;
    panel.state.$data.setState({
      data: {
        ...panel.state.$data.state.data,
        annotations: [getVisibleRangeFrame(visibleRange.start, visibleRange.end)],
      },
    });
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
