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
import React, { ChangeEvent, RefCallback } from 'react';
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
import { useMeasure } from 'react-use';
import { debouncedFuzzySearch } from '../../../services/uFuzzy';

export interface SingleViewTableSceneState extends SceneObjectState {
  patternFrames: PatternFrame[];
  appliedPatterns?: AppliedPattern[];
  patternFilter?: string;
  filteredPatterns?: string[];
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
  // The component PatternTableViewSceneComponent contains hooks, eslint will complain if hooks are used within typescript class, so we work around this by defining the render method as a separate function
  public static Component = PatternTableViewSceneComponent;
  handleChange = debounce((e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      patternFilter: e.target.value,
    });
    this.updateVariable(e.target.value);
  }, 350);

  constructor(state: SingleViewTableSceneState) {
    super({
      ...state,
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: PATTERNS_TEXT_FILTER, value: state.patternFilter ?? '' })],
      }),
    });
  }

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

  onSearchResult(data: string[][]) {
    console.log('onSearchResult', data);
    if (!data[0].every((val, index) => val === this.state?.filteredPatterns?.[index])) {
      this.setState({
        filteredPatterns: data[0],
      });
    }
  }

  /**
   * Filter visible patterns in table, and return cell data for InteractiveTable
   * @param patternFrames
   * @param legendSyncPatterns
   * @private
   */
  public buildTableData(patternFrames: PatternFrame[], legendSyncPatterns: Set<string>): WithCustomCellData[] {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    const filteredPatternFrames = patternFrames.filter((patternFrame) => {
      if (this.state.patternFilter && this.state.filteredPatterns?.length) {
        return this.state.filteredPatterns.find((pattern) => pattern === patternFrame.pattern);
      }
      return legendSyncPatterns.size ? legendSyncPatterns.has(patternFrame.pattern) : true;
    });

    // if(this.state.filteredPatterns){
    //     // sort by index
    //     filteredPatternFrames.sort((a, b) => {
    //         return a
    //     })
    // }

    return filteredPatternFrames.map((pattern: PatternFrame) => {
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
}

const theme = config.theme2;

const getTablePatternTextStyles = (width: number) => {
  if (width > 0) {
    return css({
      minWidth: '200px',
      width: `calc(${width}px - 460px)`,
      maxWidth: '100%',
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
  tableWrapWrap: css({
    width: '100%',
    overflowX: 'hidden',
    // Need to define explicit height for overflowX
    height: 'calc(100vh - 580px)',
    minHeight: '470px',
  }),
  tableWrap: css({
    width: '100%',
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
  const { patternFrames, appliedPatterns, filteredPatterns } = model.useState();
  console.log('render', filteredPatterns);

  // Get state from parent
  const parent = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const { legendSyncPatterns } = parent.useState();

  const [ref, { width }] = useMeasure();

  // Calculate total for percentages
  const total = patternFrames.reduce((previousValue, frame) => {
    return previousValue + frame.sum;
  }, 0);

  // If search filter
  if (model.state.patternFilter) {
    debouncedFuzzySearch(
      patternFrames.map((frame) => frame.pattern),
      model.state.patternFilter,
      model.onSearchResult.bind(model)
    );
  }

  const tableData = model.buildTableData(patternFrames, legendSyncPatterns);
  const columns = model.buildColumns(total, width, appliedPatterns);

  return (
    <div>
      <div data-testid={testIds.patterns.searchWrapper}>
        <Input onChange={model.handleChange} placeholder={'Search patterns'} />
      </div>
      <div className={vizStyles.tableWrapWrap} ref={ref as RefCallback<HTMLDivElement>}>
        <div data-testid={testIds.patterns.tableWrapper} className={vizStyles.tableWrap}>
          <InteractiveTable columns={columns} data={tableData} getRowId={(r: WithCustomCellData) => r.pattern} />
        </div>
      </div>
    </div>
  );
}
