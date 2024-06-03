import {
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import React, { ChangeEvent } from 'react';
import { AppliedPattern, IndexScene } from '../../IndexScene/IndexScene';
import { DataFrame, LoadingState, PanelData } from '@grafana/data';
import { Column, Input, InteractiveTable, TooltipDisplayMode } from '@grafana/ui';
import { CellProps } from 'react-table';
import { css } from '@emotion/css';
import { onPatternClick } from './FilterByPatternsButton';
import { FilterButton } from '../../FilterButton';
import { config } from '@grafana/runtime';
import { testIds } from '../../../services/testIds';
import { debounce } from 'lodash';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { PATTERNS_TEXT_FILTER } from '../../../services/variables';

export interface SingleViewTableSceneState extends SceneObjectState {
  patternFrames: PatternFrame[];
  appliedPatterns?: AppliedPattern[];
  patternFilter?: string;
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
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: PATTERNS_TEXT_FILTER, value: state.patternFilter ?? '' })],
      }),
    });
  }

  public static Component({ model }: SceneComponentProps<PatternsViewTableScene>) {
    console.log('re-render', model.state.patternFilter);
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
      <div>
        <div data-testid={testIds.patterns.searchWrapper}>
          <Input onChange={model.handleChange} placeholder={'Search patterns'} />
        </div>
        <div data-testid={testIds.patterns.tableWrapper} className={renderStyles}>
          <InteractiveTable columns={columns} data={tableData} getRowId={(r: WithCustomCellData) => r.pattern} />
        </div>
      </div>
    );
  }

  handleChange = debounce((e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      patternFilter: e.target.value,
    });
    this.updateVariable(e.target.value);
  }, 350);

  private getVariable() {
    const variable = sceneGraph.lookupVariable(PATTERNS_TEXT_FILTER, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Logs format variable not found');
    }
    return variable;
  }

  private updateVariable(search: string) {
    const variable = this.getVariable();
    variable.changeValueTo(`|= \`${search}\``);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_logs_changed,
      {
        searchQueryLength: search.length,
        containsLevel: search.toLowerCase().includes('level'),
      }
    );
  }

  /**
   * Build columns for interactive table (wrapper for react-table v7)
   * @param total
   * @param appliedPatterns
   * @protected
   */
  protected buildColumns(total: number, appliedPatterns?: AppliedPattern[]) {
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
          return <div className={vizStyles.tablePatternText}>{props.cell.row.original.pattern}</div>;
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

const vizStyles = {
  tablePatternText: css({
    width: 'calc(100vw - 640px)',
    minWidth: '200px',
    fontFamily: theme.typography.fontFamilyMonospace,
  }),
  tableTimeSeriesWrap: css({
    width: '230px',
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

const renderStyles = css({
  maxWidth: 'calc(100vw - 31px)',
  height: '470px',
  overflowY: 'scroll',
});
