import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldType, GrafanaTheme2, LoadingState, PanelData, TimeRange } from '@grafana/data';
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
  SceneReactObject,
  SceneVariableSet,
} from '@grafana/scenes';
import { CellProps } from 'react-table';
import {
  AxisPlacement,
  Button,
  Column,
  DrawStyle,
  InteractiveTable,
  StackingMode,
  Text,
  TextLink,
  TooltipDisplayMode,
  useStyles2,
} from '@grafana/ui';
import { AddToFiltersButton } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { LayoutSwitcher } from 'Components/ServiceScene/Breakdowns/LayoutSwitcher';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { GrotError } from 'Components/GrotError';
import { VAR_LABEL_GROUP_BY } from 'services/variables';
import { getColorByIndex } from 'services/scenes';
import { LokiPattern, ServiceScene } from '../ServiceScene';
import { FilterByPatternsButton, onPatternClick } from './FilterByPatternsButton';
import { IndexScene } from '../../IndexScene/IndexScene';

export interface PatternsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
}

type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
};

interface WithCustomCellData {
  pattern: string;
  dataFrame: DataFrame;
  // samples: Array<[number, string]>,
  includeLink: () => void;
  excludeLink: () => void;
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

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  private _onActivate() {
    this.updateBody();
    const unsub = sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
      if (newState.patterns !== prevState.patterns) {
        this.updateBody();
      }
    });
    return () => unsub.unsubscribe();
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private async updateBody() {
    const children: SceneFlexItemLike[] = [];
    const lokiPatterns = sceneGraph.getAncestor(this, ServiceScene).state.patterns;
    if (!lokiPatterns) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;

    const patternFrames = this.buildPatterns(lokiPatterns, timeRange, children);

    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    this.setState({
      body: new LayoutSwitcher({
        options: [
          { value: 'grid', label: 'Grid' },
          { value: 'rows', label: 'Rows' },
          { value: 'single', label: 'Single' },
        ],
        actionView: 'patterns',
        active: 'grid',
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

  private getSingleViewLayout(patternFrames: PatternFrame[], timeRange: TimeRange, logExploration: IndexScene) {
    return new SceneFlexLayout({
      direction: 'column',
      width: 'calc(100vw - 60px)',
      maxWidth: '100%',
      children: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            patternFrames
              ? new SceneFlexItem({
                  minHeight: 300,
                  maxWidth: '100%',
                  body: PanelBuilders.timeseries()
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
                    .setTitle('Patterns')
                    .setLinks([
                      {
                        url: '',
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
                    .build(),
                })
              : //@todo undefined dataframe state
                new SceneFlexItem({
                  body: undefined,
                  $data: undefined,
                }),
          ],
        }),
        this.getSingleViewTable(patternFrames, logExploration, timeRange),
      ],
    });
  }

  private getSingleViewTable(patternFrames: PatternFrame[], logExploration: IndexScene, timeRange: TimeRange) {
    const lokiPatterns = sceneGraph.getAncestor(this, ServiceScene).state.patterns;
    if (!lokiPatterns) {
      //@todo empty state
      return new SceneFlexItem({
        body: undefined,
        $data: undefined,
      });
    }
    const tableData: WithCustomCellData[] = patternFrames.map((pattern: PatternFrame) => {
      return {
        dataFrame: pattern.dataFrame,
        pattern: pattern.pattern,
        includeLink: () =>
          onPatternClick({
            pattern: pattern.pattern,
            type: 'include',
            indexScene: logExploration,
          }),
        excludeLink: () =>
          onPatternClick({
            pattern: pattern.pattern,
            type: 'exclude',
            indexScene: logExploration,
          }),
      };
    });

    const columns: Array<Column<WithCustomCellData>> = [
      {
        id: 'volume-samples',
        header: 'Volume',
        cell: (props: CellProps<WithCustomCellData>) => {
          const panelData: PanelData = {
            timeRange: timeRange,
            series: [props.cell.row.original.dataFrame],
            state: LoadingState.Done,
          };
          const dataNode = new SceneDataNode({
            data: panelData,
          });
          const heatmap = PanelBuilders.heatmap()
            .setData(dataNode)
            .setCustomFieldConfig('hideFrom', {
              legend: true,
              tooltip: true,
              viz: true,
            })
            .setOption('yAxis', {
              axisPlacement: AxisPlacement.Hidden,
            })
            .setOption('color', {
              scheme: 'YlOrRd',
            })
            .setOption('tooltip', {
              mode: TooltipDisplayMode.None,
              yHistogram: false,
            })
            .setOption('legend', {
              show: false,
            })
            .setDisplayMode('transparent')
            .build();

          const timeSeries = PanelBuilders.timeseries()
            .setData(dataNode.clone())
            .setCustomFieldConfig('hideFrom', {
              legend: true,
              tooltip: true,
            })
            .setDisplayMode('transparent')
            .build();

          return (
            <div style={{ width: '230px' }}>
              <div style={{ height: '100px' }}>
                <heatmap.Component model={heatmap} />
              </div>
              <div style={{ height: '60px' }}>
                <timeSeries.Component model={timeSeries} />
              </div>
            </div>
          );
        },
      },
      {
        id: 'pattern',
        header: 'Pattern',
        cell: (props: CellProps<WithCustomCellData>) => {
          return (
            <div
              style={{
                width: 'calc(100vw - 640px)',
                minWidth: '200px',
                textOverflow: 'ellipsis',
                overflow: 'hidden',
              }}
              className={'hellloooo2'}
            >
              {props.cell.row.original.pattern}
            </div>
          );
        },
      },
      {
        id: 'include',
        header: undefined,
        disableGrow: true,
        cell: (props: CellProps<WithCustomCellData>) => {
          return (
            <Button
              variant={'secondary'}
              onClick={() => {
                props.cell.row.original.includeLink();
              }}
            >
              Add to search
            </Button>
          );
        },
      },
      {
        id: 'exclude',
        header: undefined,
        disableGrow: true,
        cell: (props: CellProps<WithCustomCellData>) => {
          return (
            <Button variant={'secondary'} onClick={() => props.cell.row.original.excludeLink()}>
              Exclude from search
            </Button>
          );
        },
      },
    ];

    return new SceneFlexItem({
      body: new SceneReactObject({
        reactNode: (
          <div
            style={{
              maxWidth: 'calc(100vw - 31px)',
            }}
            className={'hello-weird-thing2'}
          >
            <InteractiveTable columns={columns} data={tableData} getRowId={(r: WithCustomCellData) => r.pattern} />
          </div>
        ),
      }),
    });
  }

  private buildPatterns(patterns: LokiPattern[], timeRange: TimeRange, children: SceneFlexItemLike[]): PatternFrame[] {
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

        return {
          dataFrame,
          pattern: pat.pattern,
          sum,
        };
      })
      .sort((a, b) => b.sum - a.sum);

    for (let i = 0; i < frames.length; i++) {
      const { dataFrame, pattern, sum } = frames[i];
      children.push(this.buildPatternTimeseries(dataFrame, timeRange, pattern, sum, i, minValue, maxValue));
    }

    return frames;
  }

  private buildPatternTimeseries(
    dataFrame: DataFrame,
    timeRange: TimeRange,
    pattern: string,
    sum: number,
    index: number,
    minValue: number,
    maxValue: number
  ) {
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
      .setHeaderActions([
        new FilterByPatternsButton({ pattern: pattern, type: 'exclude' }),
        new FilterByPatternsButton({ pattern: pattern, type: 'include' }),
      ])
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

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}

export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    return (
      <Button variant="secondary" size="sm" fill="text" onClick={model.onClick}>
        Select
      </Button>
    );
  };

  public onClick = () => {
    getPatternsSceneFor(this).onChange(this.state.labelName);
  };
}

function getPatternsSceneFor(model: SceneObject): PatternsBreakdownScene {
  if (model instanceof PatternsBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getPatternsSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
