import React from 'react';

import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRangeLike,
  VizPanel,
} from '@grafana/scenes';
import { LineFilter } from './LineFilter';
import { LOGS_TABLE_PLUGIN_ID, LogsPanelHeaderActions } from '../Table/tablePanel';
import { AdHocVariableFilter, TimeRange } from '@grafana/data';
import { VAR_FIELDS } from '../../services/variables';
import { SelectedTableRow } from '../Table/LogLineCellComponent';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  visualizationType: LogsVisualizationType;
  urlColumns?: string[];
  selectedLine?: SelectedTableRow;
  $timeRange?: SceneTimeRangeLike;
}

// Values/callbacks passed into react table component from scene
export interface TablePanelProps {
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
  urlColumns?: string[];
  setUrlColumns: (columns: string[]) => void;
}

export type LogsVisualizationType = 'logs' | 'table';
// If we use the local storage key from explore the user will get more consistent UX?
const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['urlColumns', 'selectedLine', 'visualizationType'],
  });
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType:
        (localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) as LogsVisualizationType) ?? 'table',
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  getUrlState() {
    const urlColumns = this.state.urlColumns ?? [];
    const selectedLine = this.state.selectedLine;
    const visualizationType = this.state.visualizationType;
    return {
      urlColumns: JSON.stringify(urlColumns),
      selectedLine: JSON.stringify(selectedLine),
      visualizationType: JSON.stringify(visualizationType),
    };
  }
  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    if (typeof values.urlColumns === 'string') {
      const decodedUrlColumns: string[] = JSON.parse(values.urlColumns);
      if (decodedUrlColumns !== this.state.urlColumns) {
        stateUpdate.urlColumns = decodedUrlColumns;
      }
    }
    if (typeof values.selectedLine === 'string') {
      const decodedSelectedTableRow: SelectedTableRow = JSON.parse(values.selectedLine);
      if (decodedSelectedTableRow !== this.state.selectedLine) {
        stateUpdate.selectedLine = decodedSelectedTableRow;
      }
    }

    if (typeof values.visualizationType === 'string') {
      const decodedVisualizationType: LogsVisualizationType = JSON.parse(values.visualizationType);
      if (decodedVisualizationType !== this.state.visualizationType) {
        stateUpdate.visualizationType = decodedVisualizationType;
      }
    }

    if (stateUpdate.urlColumns || stateUpdate.selectedLine || stateUpdate.visualizationType) {
      this.setState(stateUpdate);
    }
  }

  public _onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (prevState.visualizationType !== newState.visualizationType) {
          this.setState({
            panel: this.getVizPanel(),
          });
        }
        if (prevState.urlColumns !== newState.urlColumns) {
          //@todo how to reference body correctly?
          //@ts-ignore
          const vizPanel: VizPanel<TablePanelProps> = this.state.panel?.state.children[1].state?.body;
          vizPanel.setState({
            options: {
              ...vizPanel.state.options,
              urlColumns: newState.urlColumns,
            },
          });
        }
      })
    );

    const timeRange = sceneGraph.getTimeRange(this);
    this._subs.add(
      timeRange.subscribeToState((newState, prevState) => {
        if (
          newState.value.to.valueOf() !== prevState.value.to.valueOf() ||
          newState.value.from.valueOf() !== prevState.value.from.valueOf()
        ) {
          // @todo how to reference body correctly?
          // @ts-ignore
          const vizPanel: VizPanel<TablePanelProps> = this.state.panel?.state.children[1].state?.body;
          vizPanel.setState({
            options: {
              ...vizPanel.state.options,
              timeRange: newState.value,
            },
          });
        }
      })
    );
  }

  private getTablePanel(): SceneFlexItem {
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
    const addFilter = (filter: AdHocVariableFilter) => {
      const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
      const filters = fields.state.filters;
      fields.setState({
        filters: [...filters, filter],
      });
    };

    const timeRange = sceneGraph.getTimeRange(this);

    return new SceneFlexItem({
      height: 'calc(100vh - 220px)',
      body: new VizPanel({
        pluginId: LOGS_TABLE_PLUGIN_ID,
        options: {
          filters: fields.state.filters,
          addFilter,
          setUrlColumns: (urlColumns) => {
            if (JSON.stringify(urlColumns) !== JSON.stringify(this.state.urlColumns)) {
              this.setState({ urlColumns });
            }
          },
          urlColumns: this.state.urlColumns,
          timeRange: timeRange.state.value,
          selectedLine: this.state.selectedLine,

          // @todo selected line should be moved to table scene,
        } as TablePanelProps,
        $data: this.state.$data,
        title: 'Logs',
        headerActions: (
          <LogsPanelHeaderActions
            vizType={this.state.visualizationType}
            onChange={this.setVisualizationType.bind(this)}
          />
        ),
      }),
    });
  }

  private getLogsPanel() {
    return new SceneFlexItem({
      height: 'calc(100vh - 220px)',
      body: PanelBuilders.logs()
        .setTitle('Logs')
        .setOption('showLogContextToggle', true)
        .setOption('showTime', true)
        .setHeaderActions(
          <LogsPanelHeaderActions
            vizType={this.state.visualizationType}
            onChange={this.setVisualizationType.bind(this)}
          />
        )
        .build(),
    });
  }

  private setVisualizationType(type: LogsVisualizationType) {
    this.setState({
      visualizationType: type,
    });
    localStorage.setItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY, type);
  }

  private getVizPanel() {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new LineFilter(),
          ySizing: 'content',
        }),
        this.state.visualizationType === 'logs' ? this.getLogsPanel() : this.getTablePanel(),
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({}),
  });
}
