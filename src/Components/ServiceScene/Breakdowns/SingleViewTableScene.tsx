import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { PatternFrame } from './PatternsBreakdownScene';
import React from 'react';
import { AppliedPattern, IndexScene } from '../../IndexScene/IndexScene';
import { DataFrame, LoadingState, PanelData, TimeRange } from '@grafana/data';
import { Button, Column, InteractiveTable, TooltipDisplayMode } from '@grafana/ui';
import { CellProps } from 'react-table';
import { css } from '@emotion/css';
import { onPatternClick } from './FilterByPatternsButton';

export interface SingleViewTableSceneState extends SceneObjectState {
  legendSyncPatterns: string[] | undefined;
  timeRange: TimeRange;
  patternFrames: PatternFrame[];
  appliedPatterns?: AppliedPattern[];
}

interface WithCustomCellData {
  pattern: string;
  dataFrame: DataFrame;
  sum: number;
  // samples: Array<[number, string]>,
  includeLink: () => void;
  excludeLink: () => void;
}

function getVizStyles() {
  return {
    tableWrap: css({
      maxWidth: 'calc(100vw - 31px)',
    }),
    tableTimeSeriesWrap: css({
      width: '230px',
    }),
    tableTimeSeries: css({
      height: '60px',
      overflow: 'hidden',
      // Hide header on hover hack
      '.show-on-hover': {
        display: 'none',
      },
    }),
  };
}

export class SingleViewTableScene extends SceneObjectBase<SingleViewTableSceneState> {
  constructor(state: SingleViewTableSceneState) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public static Component({ model }: SceneComponentProps<SingleViewTableScene>) {
    console.log('rendering SingleViewTableScene', model);
    const styles = getVizStyles();
    const { patternFrames, legendSyncPatterns, timeRange, appliedPatterns } = model.useState();

    const total = patternFrames.reduce((previousValue, frame) => {
      return previousValue + frame.sum;
    }, 0);

    const logExploration = sceneGraph.getAncestor(model, IndexScene);
    const tableData: WithCustomCellData[] = patternFrames
      .filter((patternFrame) => {
        if (legendSyncPatterns?.length) {
          return legendSyncPatterns.find((pattern) => pattern === patternFrame.pattern);
        } else {
          return true;
        }
      })
      .map((pattern: PatternFrame) => {
        return {
          dataFrame: pattern.dataFrame,
          pattern: pattern.pattern,
          sum: pattern.sum,
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

          const timeSeries = PanelBuilders.timeseries()
            .setData(dataNode)
            .setHoverHeader(true)
            //@ts-ignore
            .setOption('hoverHeaderOffset', 10)

            .setOption('tooltip', {
              mode: TooltipDisplayMode.None,
            })
            .setCustomFieldConfig('hideFrom', {
              legend: true,
              tooltip: true,
            })
            .setDisplayMode('transparent')
            .build();

          return (
            <div className={styles.tableTimeSeriesWrap}>
              <div className={styles.tableTimeSeries}>
                <timeSeries.Component model={timeSeries} />
              </div>
            </div>
          );
        },
      },
      {
        id: 'percent',
        header: '%',
        cell: (props) => <div>{((100 * props.cell.row.original.sum) / total).toFixed(1)}</div>,
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
          const existingPattern = appliedPatterns?.find(
            (appliedPattern) => appliedPattern.pattern === props.cell.row.original.pattern
          );
          if (existingPattern?.type !== 'include') {
            //@todo only if not already filtered
            return (
              <Button
                variant={'secondary'}
                fill={'outline'}
                size={'sm'}
                onClick={() => {
                  props.cell.row.original.includeLink();
                }}
              >
                Select
              </Button>
            );
          }
          return <></>;
        },
      },
      {
        id: 'exclude',
        header: undefined,
        disableGrow: true,
        cell: (props: CellProps<WithCustomCellData>) => {
          return (
            <Button
              variant={'secondary'}
              fill={'outline'}
              size={'sm'}
              onClick={() => props.cell.row.original.excludeLink()}
            >
              Exclude
            </Button>
          );
        },
      },
    ];

    return (
      <div className={styles.tableWrap}>
        <InteractiveTable columns={columns} data={tableData} getRowId={(r: WithCustomCellData) => r.pattern} />
      </div>
    );
  }

  private _onActivate() {
    this.subscribeToState((newState, prevState) => {
      if (prevState.legendSyncPatterns !== newState.legendSyncPatterns) {
        console.log('should re-render', newState.legendSyncPatterns);
      }
    });
  }
}
