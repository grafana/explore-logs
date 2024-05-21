import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import React from 'react';
import { AppliedPattern, IndexScene } from '../../IndexScene/IndexScene';
import { DataFrame, LoadingState, PanelData } from '@grafana/data';
import { Button, Column, InteractiveTable, TooltipDisplayMode } from '@grafana/ui';
import { CellProps } from 'react-table';
import { css } from '@emotion/css';
import { onPatternClick } from './FilterByPatternsButton';

export interface SingleViewTableSceneState extends SceneObjectState {
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

export class SingleViewTableScene extends SceneObjectBase<SingleViewTableSceneState> {
  constructor(state: SingleViewTableSceneState) {
    super({
      ...state,
    });
  }

  public static Component({ model }: SceneComponentProps<SingleViewTableScene>) {
    const styles = getVizStyles();
    const { patternFrames, appliedPatterns } = model.useState();

    // Get state from parent
    const parent = sceneGraph.getAncestor(model, PatternsBreakdownScene);
    const { legendSyncPatterns } = parent.useState();

    // Calculate total for percentages
    const total = patternFrames.reduce((previousValue, frame) => {
      return previousValue + frame.sum;
    }, 0);

    const tableData = model.buildTableData(patternFrames, legendSyncPatterns);
    const columns = model.buildColumns(total, appliedPatterns);

    return (
      <div className={styles.tableWrap}>
        <InteractiveTable columns={columns} data={tableData} getRowId={(r: WithCustomCellData) => r.pattern} />
      </div>
    );
  }

  /**
   * Build columns for interactive table (wrapper for react-table v7)
   * @param total
   * @param appliedPatterns
   * @protected
   */
  protected buildColumns(total: number, appliedPatterns?: AppliedPattern[]) {
    const styles = getVizStyles();
    const timeRange = sceneGraph.getTimeRange(this).state.value;
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
          const existingPattern = appliedPatterns?.find(
            (appliedPattern) => appliedPattern.pattern === props.cell.row.original.pattern
          );
          if (existingPattern?.type !== 'exclude') {
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
          }
          return <></>;
        },
      },
    ];
    return columns;
  }

  /**
   * Filter visible patterns in table, and return cell data for InteractiveTable
   * @param patternFrames
   * @param legendSyncPatterns
   * @private
   */
  private buildTableData(patternFrames: PatternFrame[], legendSyncPatterns: Set<string>): WithCustomCellData[] {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);
    return patternFrames
      .filter((patternFrame) => {
        return legendSyncPatterns.size ? legendSyncPatterns.has(patternFrame.pattern) : true;
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
  }
}

function getVizStyles() {
  return {
    tableWrap: css({
      maxWidth: 'calc(100vw - 31px)',
      height: '470px',
      overflowY: 'scroll',
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