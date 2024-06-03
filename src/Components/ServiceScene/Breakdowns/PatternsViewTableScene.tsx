import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import React, { RefCallback } from 'react';
import { AppliedPattern, IndexScene } from '../../IndexScene/IndexScene';
import { DataFrame, LoadingState, PanelData } from '@grafana/data';
import { Column, InteractiveTable, TooltipDisplayMode } from '@grafana/ui';
import { CellProps } from 'react-table';
import { css } from '@emotion/css';
import { onPatternClick } from './FilterByPatternsButton';
import { FilterButton } from '../../FilterButton';
import { config } from '@grafana/runtime';
import { testIds } from '../../../services/testIds';
import { useMeasure } from 'react-use';

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
  undoLink: () => void;
}

export class PatternsViewTableScene extends SceneObjectBase<SingleViewTableSceneState> {
  constructor(state: SingleViewTableSceneState) {
    super({
      ...state,
    });
  }

  // The component PatternTableViewSceneComponent contains hooks, eslint will complain if hooks are used within typescript class, so we work around this by defining the render method as a separate function
  public static Component = PatternTableViewSceneComponent;

  /**
   * Build columns for interactive table (wrapper for react-table v7)
   * @param total
   * @param containerWidth
   * @param appliedPatterns
   * @protected
   */
  public buildColumns(total: number, containerWidth: number, appliedPatterns?: AppliedPattern[]) {
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const columns: Array<Column<WithCustomCellData>> = [
      {
        id: 'volume-samples',
        header: '',
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
            <div className={vizStyles.tableTimeSeriesWrap}>
              <div className={vizStyles.tableTimeSeries}>
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
          return <div className={getTablePatternTextStyles(containerWidth)}>{props.cell.row.original.pattern}</div>;
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
          const isIncluded = existingPattern?.type === 'include';
          const isExcluded = existingPattern?.type === 'exclude';
          return (
            <FilterButton
              isExcluded={isExcluded}
              isIncluded={isIncluded}
              onInclude={() => props.cell.row.original.includeLink()}
              onExclude={() => props.cell.row.original.excludeLink()}
              onReset={() => props.cell.row.original.undoLink()}
            />
          );
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
  public buildTableData(patternFrames: PatternFrame[], legendSyncPatterns: Set<string>): WithCustomCellData[] {
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
          undoLink: () =>
            onPatternClick({
              pattern: pattern.pattern,
              type: 'undo',
              indexScene: logExploration,
            }),
        };
      });
  }
}

const theme = config.theme2;

const getTablePatternTextStyles = (width: number) => {
  if (width > 0) {
    return css({
      minWidth: '200px',
      width: `calc(${width}px - 640px)`,
      fontFamily: theme.typography.fontFamilyMonospace,
      overflow: 'hidden',
      overflowWrap: 'break-word',
    });
  }
  return css({
    minWidth: '200px',
    fontFamily: theme.typography.fontFamilyMonospace,
    overflow: 'hidden',
    overflowWrap: 'break-word',
  });
};

const vizStyles = {
  tableTimeSeriesWrap: css({
    width: '230px',
  }),
  table: css({
    width: '100%',
    overflow: 'hidden',
  }),
  tableWrapWrap: css({
    width: '100%',
    overflow: 'hidden',
  }),
  tableWrap: css({
    // mostly works, but still overflows (with horizontal scroll) on smaller viewports with long pattern text
    maxWidth: 'calc(100vw - 34px)',
    width: '100%',
    height: '470px',
    overflowY: 'scroll',
  }),
  tableTimeSeries: css({
    height: '30px',
    overflow: 'hidden',
    // Hide header on hover hack
    '.show-on-hover': {
      display: 'none',
    },
  }),
};

export function PatternTableViewSceneComponent({ model }: SceneComponentProps<PatternsViewTableScene>) {
  const { patternFrames, appliedPatterns } = model.useState();

  // Get state from parent
  const parent = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const { legendSyncPatterns } = parent.useState();

  const [ref, { width }] = useMeasure();

  // Calculate total for percentages
  const total = patternFrames.reduce((previousValue, frame) => {
    return previousValue + frame.sum;
  }, 0);

  const tableData = model.buildTableData(patternFrames, legendSyncPatterns);
  const columns = model.buildColumns(total, width, appliedPatterns);

  return (
    <div ref={ref as RefCallback<HTMLDivElement>} className={vizStyles.tableWrapWrap}>
      <div data-testid={testIds.patterns.tableWrapper} className={vizStyles.tableWrap}>
        <InteractiveTable
          className={vizStyles.table}
          columns={columns}
          data={tableData}
          getRowId={(r: WithCustomCellData) => r.pattern}
        />
      </div>
    </div>
  );
}
