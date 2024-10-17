import React from 'react';

import { ConfigOverrideRule, FieldColor, LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode } from '@grafana/ui';
import { ServiceScene } from '../../ServiceScene';
import { onPatternClick } from './FilterByPatternsButton';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { PatternsViewTableScene } from './PatternsViewTableScene';
import { config } from '@grafana/runtime';
import { css } from '@emotion/css';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import { areArraysEqual } from '../../../../services/comparison';
import { logger } from '../../../../services/logger';

const palette = config.theme2.visualization.palette;

export interface PatternsFrameSceneState extends SceneObjectState {
  body?: SceneCSSGridLayout;
  loading?: boolean;
  legendSyncPatterns: Set<string>;
}

export class PatternsFrameScene extends SceneObjectBase<PatternsFrameSceneState> {
  constructor(state?: Partial<PatternsFrameSceneState>) {
    super({
      loading: true,
      ...state,
      legendSyncPatterns: new Set(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsFrameScene>) => {
    const { body, loading } = model.useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { $patternsData } = logsByServiceScene.useState();
    const patterns = $patternsData?.state.data?.series;

    return (
      <div className={styles.container}>
        {!loading && patterns && patterns.length > 0 && <>{body && <body.Component model={body} />}</>}
      </div>
    );
  };

  private onActivate() {
    this.updateBody();

    // If the patterns have changed, recalculate the dataframes
    this._subs.add(
      sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
        const newFrame = newState?.$patternsData?.state?.data?.series;
        const prevFrame = prevState?.$patternsData?.state?.data?.series;

        if (!areArraysEqual(newFrame, prevFrame)) {
          const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          this.updatePatterns(patternsBreakdownScene.state.patternFrames);

          // In order to keep the search state from clearing, we need to clear the filtered state
          patternsBreakdownScene.setState({
            filteredPatterns: undefined,
          });
        }
      })
    );

    // If the text search results have changed, update the components to use the filtered dataframe
    this._subs.add(
      sceneGraph.getAncestor(this, PatternsBreakdownScene).subscribeToState((newState, prevState) => {
        const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
        if (newState.filteredPatterns && !areArraysEqual(newState.filteredPatterns, prevState.filteredPatterns)) {
          this.updatePatterns(patternsBreakdownScene.state.filteredPatterns);
        } else {
          // If there is no search string, clear the state
          if (!patternsBreakdownScene.state.patternFilter) {
            this.updatePatterns(patternsBreakdownScene.state.patternFrames);
          }
        }
      })
    );
  }

  private async updatePatterns(patternFrames: PatternFrame[] = []) {
    // CSS Grid doesn't need rebuilding, just the children need the updated dataframe
    this.state.body?.forEachChild((child) => {
      if (child instanceof VizPanel) {
        child.setState({
          $data: this.getTimeseriesDataNode(patternFrames),
        });
      }
      if (child instanceof PatternsViewTableScene) {
        child.setState({
          patternFrames,
        });
      }
    });
  }

  private async updateBody() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternsBreakdownScene.state.patternFrames;

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    const lokiPatterns = serviceScene.state.$patternsData?.state.data?.series;
    if (!lokiPatterns || !patternFrames) {
      logger.warn('Failed to update PatternsFrameScene body');
      return;
    }

    this.setState({
      body: this.getSingleViewLayout(),
      legendSyncPatterns: new Set(),
      loading: false,
    });
  }

  private extendTimeSeriesLegendBus(vizPanel: VizPanel, context: PanelContext) {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (label: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(label, mode);

      const override: ConfigOverrideRule | undefined = vizPanel.state.fieldConfig.overrides?.[0];
      const patternsToShow: string[] = override?.matcher.options.names;
      const legendSyncPatterns = new Set<string>();

      if (patternsToShow) {
        patternsToShow.forEach(legendSyncPatterns.add, legendSyncPatterns);
      }

      this.setState({
        legendSyncPatterns,
      });
    };
  }

  private getSingleViewLayout() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternsBreakdownScene.state.patternFrames;

    if (!patternFrames) {
      logger.warn('Failed to set getSingleViewLayout');
      return;
    }

    const timeSeries = this.getTimeSeries(patternFrames);

    return new SceneCSSGridLayout({
      templateColumns: '100%',
      autoRows: '200px',
      isLazy: true,

      children: [
        timeSeries,
        new PatternsViewTableScene({
          patternFrames,
        }),
      ],
    });
  }

  private getTimeSeries(patternFrames: PatternFrame[]) {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    const timeSeries = PanelBuilders.timeseries()
      .setData(this.getTimeseriesDataNode(patternFrames))
      .setOption('legend', {
        asTable: true,
        showLegend: true,
        displayMode: LegendDisplayMode.Table,
        placement: 'right',
        width: 200,
      })
      .setHoverHeader(true)
      .setUnit('short')
      .setLinks([
        {
          url: '#',
          targetBlank: false,
          onClick: (event) => {
            onPatternClick({
              pattern: event.origin.labels.name,
              type: 'include',
              indexScene: logExploration,
            });
          },
          title: 'Include',
        },
        {
          url: '#',
          targetBlank: false,
          onClick: (event) => {
            onPatternClick({
              pattern: event.origin.labels.name,
              type: 'exclude',
              indexScene: logExploration,
            });
          },
          title: 'Exclude',
        },
      ])
      .build();

    timeSeries.setState({
      extendPanelContext: (vizPanel, context) => this.extendTimeSeriesLegendBus(vizPanel, context),
    });

    return timeSeries;
  }

  private getTimeseriesDataNode(patternFrames: PatternFrame[]) {
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    return new SceneDataNode({
      data: {
        series: patternFrames.map((patternFrame, seriesIndex) => {
          // Mutating the dataframe config here means that we don't need to update the colors in the table view
          const dataFrame = patternFrame.dataFrame;
          dataFrame.fields[1].config.color = overrideToFixedColor(seriesIndex);
          dataFrame.fields[1].name = '';
          return dataFrame;
        }),
        state: LoadingState.Done,
        timeRange: timeRange,
      },
    });
  }
}

export function overrideToFixedColor(key: keyof typeof palette): FieldColor {
  return {
    mode: 'fixed',
    fixedColor: palette[key] as string,
  };
}

const styles = {
  container: css({
    width: '100%',
    // Hide header on hover hack
    '.show-on-hover': {
      display: 'none',
    },
  }),
};
