import React from 'react';

import { ConfigOverrideRule, DataFrame, FieldColor, LoadingState } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode } from '@grafana/ui';
import { ServiceScene } from '../ServiceScene';
import { onPatternClick } from './FilterByPatternsButton';
import { IndexScene } from '../../IndexScene/IndexScene';
import { PatternsViewTableScene } from './PatternsViewTableScene';
import { config } from '@grafana/runtime';
import { css } from '@emotion/css';
import { PatternsBreakdownScene } from './PatternsBreakdownScene';

const palette = config.theme2.visualization.palette;

export interface PatternsFrameSceneState extends SceneObjectState {
  body?: SceneObject;
  loading?: boolean;
  patternFrames?: PatternFrame[];
  legendSyncPatterns: Set<string>;
  patternFilter?: string;
}

export type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
  status?: 'include' | 'exclude';
};

export class PatternsFrameScene extends SceneObjectBase<PatternsFrameSceneState> {
  constructor(state: { patternFrames?: PatternFrame[] }) {
    super({
      loading: true,
      ...state,
      patternFrames: state.patternFrames,
      legendSyncPatterns: new Set(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsFrameScene>) => {
    const { body, loading } = model.useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { patterns } = logsByServiceScene.useState();
    return (
      <div className={styles.container}>
        {!loading && patterns && patterns.length > 0 && <>{body && <body.Component model={body} />}</>}
      </div>
    );
  };

  private onActivate() {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    this.updateBody(parent.state.patternFrames);

    // If the patterns have changed, recalculate the dataframes
    this._subs.add(
      sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
        if (newState.patterns !== prevState.patterns) {
          this.updateBody(parent.state.patternFrames);
        }
      })
    );

    // If the text search results have changed, update the components to use the filtered dataframe
    this._subs.add(
      sceneGraph.getAncestor(this, PatternsBreakdownScene).subscribeToState((newState, prevState) => {
        if (newState.filteredPatterns && newState.filteredPatterns !== prevState.filteredPatterns) {
          this.updateBody(newState.filteredPatterns);
        } else {
          this.updateBody(newState.patternFrames);
        }
      })
    );
  }

  private async updateBody(patternFrames?: PatternFrame[]) {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const lokiPatterns = serviceScene.state.patterns;
    if (!lokiPatterns || !patternFrames) {
      return;
    }

    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    this.setState({
      body: this.getSingleViewLayout(patternFrames, logExploration),
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

  private getSingleViewLayout(patternFrames: PatternFrame[], logExploration: IndexScene) {
    const appliedPatterns = sceneGraph.getAncestor(logExploration, IndexScene).state.patterns;
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    const timeSeries = PanelBuilders.timeseries()
      .setData(
        new SceneDataNode({
          data: {
            series: patternFrames.map((patternFrame, seriesIndex) => {
              // Mutating the dataframe config here means that we don't need to update the colors in the table view
              const dataFrame = patternFrame.dataFrame;
              dataFrame.fields[1].config.color = overrideToFixedColor(seriesIndex);
              return dataFrame;
            }),
            state: LoadingState.Done,
            timeRange: timeRange,
          },
        })
      )
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
              pattern: event.origin.name,
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
              pattern: event.origin.name,
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

    return new SceneCSSGridLayout({
      templateColumns: '100%',
      // templateRows: 'auto',
      autoRows: '200px',

      children: [
        new SceneFlexItem({
          minHeight: 200,
          maxWidth: '100%',
          body: timeSeries,
        }),
        new PatternsViewTableScene({
          patternFrames,
          appliedPatterns,
        }),
      ],
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
