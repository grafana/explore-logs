import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldType, GrafanaTheme2, LoadingState, TimeRange } from '@grafana/data';
import {
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  sceneUtils,
  SceneVariableSet,
  VizPanel,
  VizPanelState,
} from '@grafana/scenes';
import {
  DrawStyle,
  LegendDisplayMode,
  PanelContext,
  SeriesVisibilityChangeMode,
  StackingMode,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { LayoutSwitcher, LayoutSwitcherState } from 'Components/ServiceScene/Breakdowns/LayoutSwitcher';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { GrotError } from 'Components/GrotError';
import { VAR_LABEL_GROUP_BY } from 'services/variables';
import { getColorByIndex } from 'services/scenes';
import { LokiPattern, ServiceScene } from '../ServiceScene';
import { FilterByPatternsButton, onPatternClick } from './FilterByPatternsButton';
import { IndexScene } from '../../IndexScene/IndexScene';
import { SingleViewTableScene } from './SingleViewTableScene';

export interface PatternsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  //@todo convert to set

  legendSyncPatterns: Set<string>;
}

export type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
  status?: 'include' | 'exclude';
};

function buildPatternHeaderActions(
  status: 'include' | 'exclude' | undefined,
  pattern: string
): VizPanelState['headerActions'] {
  if (status) {
    if (status === 'include') {
      return [new FilterByPatternsButton({ pattern: pattern, type: 'exclude' })];
    } else {
      return [new FilterByPatternsButton({ pattern: pattern, type: 'include' })];
    }
  } else {
    return [
      new FilterByPatternsButton({ pattern: pattern, type: 'exclude' }),
      new FilterByPatternsButton({ pattern: pattern, type: 'include' }),
    ];
  }
}

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
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.legendSyncPatterns !== prevState.legendSyncPatterns) {
          const lokiPatterns = sceneGraph.getAncestor(this, ServiceScene).state.patterns;
          console.log('newState.visiblePatterns', newState.legendSyncPatterns);
          if (!lokiPatterns) {
            return;
          }

          console.log('newState.visiblePatterns', newState.legendSyncPatterns);

          // this.updateBody();
          const flexLayout = newState?.body?.state as LayoutSwitcherState;
          console.log('layouts', flexLayout.layouts);

          const timeRange = sceneGraph.getTimeRange(this).state.value;

          const { frames: patternFrames } = this.buildPatterns(lokiPatterns, timeRange);

          const logExploration = sceneGraph.getAncestor(this, IndexScene);
          const targetFlexLayout = flexLayout.layouts[2] as SceneFlexLayout;

          //@todo unhack
          //@ts-ignore
          targetFlexLayout.setState(this.getSingleViewLayout(patternFrames, timeRange, logExploration));
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

    const timeRange = sceneGraph.getTimeRange(this).state.value;

    const { children, frames: patternFrames } = this.buildPatterns(lokiPatterns, timeRange);

    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    this.setState({
      body: new LayoutSwitcher({
        options: [
          { value: 'grid', label: 'Grid' },
          { value: 'rows', label: 'Rows' },
          { value: 'single', label: 'Single' },
        ],
        actionView: 'patterns',
        active: 'single',
        layouts: [
          new SceneCSSGridLayout({
            templateColumns: GRID_TEMPLATE_COLUMNS,
            autoRows: '200px',
            isLazy: true,
            children: children,
          }),
          new SceneCSSGridLayout({
            templateColumns: '1fr',
            autoRows: '200px',
            isLazy: true,
            children: children.map((child) => child.clone()),
          }),
          this.getSingleViewLayout(patternFrames, timeRange, logExploration),
        ],
      }),
      loading: false,
    });
  }

  private extendTimeSeriesLegendBus(vizPanel: VizPanel, context: PanelContext) {
    const originalFn = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (label: string, mode: SeriesVisibilityChangeMode) => {
      // console.log('context.onToggleSeriesVisibility', context.onToggleSeriesVisibility)
      originalFn?.(label, mode);

      const legendSyncPatterns = this.state.legendSyncPatterns;
      if (legendSyncPatterns.has(label)) {
        legendSyncPatterns.delete(label);
        this.setState({
          legendSyncPatterns,
        });
      } else {
        legendSyncPatterns.add(label);
        this.setState({
          legendSyncPatterns,
        });
      }
    };
  }

  private getSingleViewLayout(patternFrames: PatternFrame[], timeRange: TimeRange, logExploration: IndexScene) {
    const appliedPatterns = sceneGraph.getAncestor(logExploration, IndexScene).state.patterns;
    const timeSeries = PanelBuilders.timeseries()
      .setData(
        new SceneDataNode({
          data: {
            series: patternFrames.map((patternFrame) => {
              return patternFrame.dataFrame;
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
        //@todo only if not already filtered
        {
          url: '',
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
          url: '',
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

    const panelState = sceneUtils.cloneSceneObjectState(timeSeries.state);

    const panel = new VizPanel({
      ...panelState,
      extendPanelContext: (vizPanel, context) => this.extendTimeSeriesLegendBus(vizPanel, context),
    });

    console.log('LegendSync', this.state.legendSyncPatterns);

    return new SceneFlexLayout({
      direction: 'column',
      width: 'calc(100vw - 60px)',
      maxWidth: '100%',
      children: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              maxWidth: '100%',
              body: panel,
            }),
          ],
        }),
        new SingleViewTableScene({
          timeRange,
          legendSyncPatterns: this.state.legendSyncPatterns,
          patternFrames,
          appliedPatterns,
        }),
      ],
    });
  }

  private buildPatterns(
    patterns: LokiPattern[],
    timeRange: TimeRange
  ): { children: SceneFlexItemLike[]; frames: PatternFrame[] } {
    const children: SceneFlexItemLike[] = [];
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const appliedPatterns = sceneGraph.getAncestor(serviceScene, IndexScene).state.patterns;

    let maxValue = -Infinity;
    let minValue = 0;

    const frames: PatternFrame[] = patterns
      .map((pat, frameIndex) => {
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

    for (let i = 0; i < frames.length; i++) {
      children.push(this.buildPatternTimeseries(frames[i], timeRange, i, minValue, maxValue));
    }

    return { children, frames };
  }

  private buildPatternTimeseries(
    patternFrame: PatternFrame,
    timeRange: TimeRange,
    index: number,
    minValue: number,
    maxValue: number
  ) {
    const { dataFrame, pattern, sum, status } = patternFrame;
    const headerActions = buildPatternHeaderActions(status, pattern);
    return PanelBuilders.timeseries()
      .setTitle(`${pattern}`)

      .setDescription(`The pattern \`${pattern}\` has been matched \`${sum}\` times in the given timerange.`)
      .setOption('legend', { showLegend: false })
      .setData(
        new SceneDataNode({
          data: {
            series: [dataFrame],
            state: LoadingState.Done,
            timeRange,
          },
        })
      )
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(index) })
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setCustomFieldConfig('axisSoftMax', maxValue)
      .setCustomFieldConfig('axisSoftMin', minValue)
      .setHeaderActions(headerActions)
      .build();
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

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(600px, 1fr))';

export function buildPatternsScene() {
  return new SceneFlexItem({
    body: new PatternsBreakdownScene({}),
  });
}
