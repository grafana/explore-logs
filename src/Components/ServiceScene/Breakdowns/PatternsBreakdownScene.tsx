import { css } from '@emotion/css';
import React from 'react';

import { ConfigOverrideRule, DataFrame, FieldColor, FieldType, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { LegendDisplayMode, PanelContext, SeriesVisibilityChangeMode, Text, TextLink, useStyles2 } from '@grafana/ui';
import { LayoutSwitcher } from 'Components/ServiceScene/Breakdowns/LayoutSwitcher';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { GrotError } from 'Components/GrotError';
import { VAR_LABEL_GROUP_BY } from 'services/variables';
import { LokiPattern, ServiceScene } from '../ServiceScene';
import { onPatternClick } from './FilterByPatternsButton';
import { IndexScene } from '../../IndexScene/IndexScene';
import { PatternsViewTableScene } from './PatternsViewTableScene';
import { config } from '@grafana/runtime';

const palette = config.theme2.visualization.palette;

export interface PatternsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  legendSyncPatterns: Set<string>;
}

export type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
  status?: 'include' | 'exclude';
};

export class PatternsBreakdownScene extends SceneObjectBase<PatternsBreakdownSceneState> {
  constructor(state: Partial<PatternsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      loading: true,
      legendSyncPatterns: new Set(),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsBreakdownScene>) => {
    const { body, loading, blockingMessage } = model.useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { patterns } = logsByServiceScene.useState();
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          {!loading && !patterns && (
            <div className={styles.patternMissingText}>
              <Text textAlignment="center" color="primary">
                <p>There are no pattern matches.</p>
                <p>Pattern matching has not been configured.</p>
                <p>Patterns let you detect similar log lines and add or exclude them from your search.</p>
                <p>To see them in action, add the following to your configuration</p>
                <p>
                  <code>--pattern-ingester.enabled=true</code>
                </p>
              </Text>
            </div>
          )}
          {!loading && patterns?.length === 0 && (
            <GrotError>
              <div>
                Sorry, we could not detect any patterns.
                <p>
                  Check back later or reachout to the{' '}
                  <TextLink href="https://slack.grafana.com/" external>
                    Grafana Labs community Slack channel
                  </TextLink>
                </p>
                Patterns let you detect similar log lines and add or exclude them from your search.
              </div>
            </GrotError>
          )}
          {!loading && patterns && patterns.length > 0 && (
            <>
              <div className={styles.controls}>
                {body instanceof LayoutSwitcher && (
                  <div className={styles.controlsRight}>
                    <body.Selector model={body} />
                  </div>
                )}
              </div>
              <div className={styles.content}>{body && <body.Component model={body} />}</div>
            </>
          )}
        </StatusWrapper>
      </div>
    );
  };

  private _onActivate() {
    this.updateBody();
    this._subs.add(
      sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
        if (newState.patterns !== prevState.patterns) {
          this.updateBody();
        }
      })
    );
  }

  private async updateBody() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const lokiPatterns = serviceScene.state.patterns;
    if (!lokiPatterns) {
      return;
    }

    const patternFrames = this.buildPatterns(lokiPatterns);

    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    this.setState({
      body: this.getSingleViewLayout(patternFrames, logExploration),
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
      .setTitle('Patterns')
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
          title: 'Select',
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

    return new SceneFlexLayout({
      direction: 'column',
      width: 'calc(100vw - 60px)',
      maxWidth: '100%',
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

  private buildPatterns(patterns: LokiPattern[]): PatternFrame[] {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const appliedPatterns = sceneGraph.getAncestor(serviceScene, IndexScene).state.patterns;

    let maxValue = -Infinity;
    let minValue = 0;

    return patterns
      .map((pat) => {
        const timeValues: number[] = [];
        const sampleValues: number[] = [];
        let sum = 0;
        pat.samples.forEach(([time, value]) => {
          timeValues.push(time * 1000);
          const sample = parseFloat(value);
          sampleValues.push(sample);
          if (sample > maxValue) {
            maxValue = sample;
          }
          if (sample < minValue) {
            minValue = sample;
          }
          sum += sample;
        });
        const dataFrame: DataFrame = {
          refId: pat.pattern,
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: timeValues,
              config: {
                custom: {
                  axisPlacement: 'hidden',
                },
              },
            },
            {
              name: pat.pattern,
              type: FieldType.number,
              values: sampleValues,
              config: {
                custom: {
                  axisPlacement: 'hidden',
                },
              },
            },
          ],
          length: pat.samples.length,
          meta: {
            preferredVisualisationType: 'graph',
          },
        };
        const existingPattern = appliedPatterns?.find((appliedPattern) => appliedPattern.pattern === pat.pattern);

        return {
          dataFrame,
          pattern: pat.pattern,
          sum,
          status: existingPattern?.type,
        };
      })
      .sort((a, b) => b.sum - a.sum);
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 0,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    controlsLeft: css({
      display: 'flex',
      justifyContent: 'flex-left',
      justifyItems: 'left',
      width: '100%',
      flexDirection: 'column',
    }),
    patternMissingText: css({
      padding: theme.spacing(2),
    }),
  };
}

export function buildPatternsScene() {
  return new SceneFlexItem({
    body: new PatternsBreakdownScene({}),
  });
}

export function overrideToFixedColor(key: keyof typeof palette): FieldColor {
  return {
    mode: 'fixed',
    fixedColor: palette[key] as string,
  };
}
