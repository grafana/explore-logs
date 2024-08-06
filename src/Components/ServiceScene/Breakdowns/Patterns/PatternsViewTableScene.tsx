import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { PatternFrame } from './PatternsBreakdownScene';
import React from 'react';
import { AppliedPattern, IndexScene } from '../../../IndexScene/IndexScene';
import { DataFrame, GrafanaTheme2, LoadingState, PanelData, scaledUnits } from '@grafana/data';
import { AxisPlacement, Column, InteractiveTable, TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import { CellProps } from 'react-table';
import { css, cx } from '@emotion/css';
import { onPatternClick } from './FilterByPatternsButton';
import { FilterButton } from '../../../FilterButton';
import { config } from '@grafana/runtime';
import { testIds } from '../../../../services/testIds';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternNameLabel } from './PatternNameLabel';
import { getExplorationFor } from 'services/scenes';
import { PatternsTableExpandedRow } from '../PatternsTableExpandedRow';

// copied from from grafana repository packages/grafana-data/src/valueFormats/categories.ts
// that is used in Grafana codebase for "short" units
const SCALED_UNITS = ['', ' K', ' Mil', ' Bil', ' Tri', ' Quadr', ' Quint', ' Sext', ' Sept'];
export interface SingleViewTableSceneState extends SceneObjectState {
  // The local copy of the pattern frames, the parent breakdown scene decides if we get the filtered subset or not, in this scene we just present the data
  patternFrames: PatternFrame[] | undefined;
  expandedRows?: SceneObject[];

  // An array of patterns to exclude links
  patternsNotMatchingFilters?: string[];
}

export interface PatternsTableCellData {
  pattern: string;
  dataFrame: DataFrame;
  sum: number;
  includeLink: () => void;
  excludeLink: () => void;
  undoLink: () => void;
}

export class PatternsViewTableScene extends SceneObjectBase<SingleViewTableSceneState> {
  constructor(state: SingleViewTableSceneState) {
    super(state);
  }

  public static Component = PatternTableViewSceneComponent;

  /**
   * Build columns for interactive table (wrapper for react-table v7)
   * @param total
   * @param appliedPatterns
   * @param theme
   * @param patternsNotMatchingFilters
   * @protected
   */
  public buildColumns(
    total: number,
    appliedPatterns: AppliedPattern[] | undefined,
    theme: GrafanaTheme2,
    patternsNotMatchingFilters?: string[]
  ) {
    const styles = getColumnStyles(theme);
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const columns: Array<Column<PatternsTableCellData>> = [
      {
        id: 'volume-samples',
        header: '',
        cell: (props: CellProps<PatternsTableCellData>) => {
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
            .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
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
        id: 'count',
        header: 'Count',
        sortType: 'number',
        cell: (props) => {
          const value = scaledUnits(1000, SCALED_UNITS)(props.cell.row.original.sum);
          return (
            <div className={styles.countTextWrap}>
              <div>
                {value.prefix ?? ''}
                {value.text}
                {value.suffix ?? ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'percent',
        header: '%',
        sortType: 'number',
        cell: (props) => (
          <div className={styles.countTextWrap}>
            <div>{((100 * props.cell.row.original.sum) / total).toFixed(0)}%</div>
          </div>
        ),
      },
      {
        id: 'pattern',
        header: 'Pattern',
        cell: (props: CellProps<PatternsTableCellData>) => {
          return (
            <div className={cx(getTablePatternTextStyles(), styles.tablePatternTextDefault)}>
              <PatternNameLabel exploration={getExplorationFor(this)} pattern={props.cell.row.original.pattern} />
            </div>
          );
        },
      },
      {
        id: 'include',
        header: undefined,
        disableGrow: true,
        cell: (props: CellProps<PatternsTableCellData>) => {
          if (patternsNotMatchingFilters?.includes(props.cell.row.original.pattern)) {
            return undefined;
          }

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
              onClear={() => props.cell.row.original.undoLink()}
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
  public buildTableData(patternFrames: PatternFrame[], legendSyncPatterns: Set<string>): PatternsTableCellData[] {
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

const getTablePatternTextStyles = () => {
  return css({
    minWidth: '200px',
    fontFamily: theme.typography.fontFamilyMonospace,
    overflow: 'hidden',
    overflowWrap: 'break-word',
  });
};

const getTableStyles = (theme: GrafanaTheme2) => {
  return {
    link: css({
      textDecoration: 'underline',
    }),
    tableWrap: css({
      // Override interactive table style
      '> div': {
        // Need to define explicit height for overflowX
        height: 'calc(100vh - 450px)',
        minHeight: '470px',
      },
      // Make table headers sticky
      th: {
        top: 0,
        position: 'sticky',
        backgroundColor: theme.colors.background.canvas,
        zIndex: theme.zIndex.navbarFixed,
      },
    }),
  };
};
const getColumnStyles = (theme: GrafanaTheme2) => {
  return {
    tablePatternTextDefault: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      minWidth: '200px',
      maxWidth: '100%',
      overflow: 'hidden',
      overflowWrap: 'break-word',
      fontSize: theme.typography.bodySmall.fontSize,
      wordBreak: 'break-word',
    }),
    countTextWrap: css({
      textAlign: 'right',
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    tableTimeSeriesWrap: css({
      width: '230px',
      pointerEvents: 'none',
    }),
    tableTimeSeries: css({
      height: '30px',
      overflow: 'hidden',
    }),
  };
};

export function PatternTableViewSceneComponent({ model }: SceneComponentProps<PatternsViewTableScene>) {
  const indexScene = sceneGraph.getAncestor(model, IndexScene);
  const { patterns: appliedPatterns } = indexScene.useState();
  const theme = useTheme2();
  const styles = getTableStyles(theme);

  // Get state from parent
  const patternsFrameScene = sceneGraph.getAncestor(model, PatternsFrameScene);
  const { legendSyncPatterns } = patternsFrameScene.useState();

  // Must use local patternFrames as the parent decides if we get the filtered or not
  const { patternFrames: patternFramesRaw, patternsNotMatchingFilters } = model.useState();
  const patternFrames = patternFramesRaw ?? [];

  // Calculate total for percentages
  const total = patternFrames.reduce((previousValue, frame) => {
    return previousValue + frame.sum;
  }, 0);

  const tableData = model.buildTableData(patternFrames, legendSyncPatterns);
  const columns = model.buildColumns(total, appliedPatterns, theme, patternsNotMatchingFilters);

  return (
    <div data-testid={testIds.patterns.tableWrapper} className={styles.tableWrap}>
      <InteractiveTable
        columns={columns}
        data={tableData}
        getRowId={(r: PatternsTableCellData) => r.pattern}
        renderExpandedRow={(row) => <PatternsTableExpandedRow tableViz={model} row={row} />}
      />
    </div>
  );
}
