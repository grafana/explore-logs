import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { LineFilter } from './LineFilter';
import { AdHocVariableFilter, TimeRange } from '@grafana/data';
import { SelectedTableRow } from '../Table/LogLineCellComponent';
import { LogsTableScene } from './LogsTableScene';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';

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

    this.subscribeToState((newState, prevState) => {
      if (newState.visualizationType !== prevState.visualizationType) {
        this.setState({
          panel: this.getVizPanel(),
        });
      }
    });
  }

  private getLogsPanel() {
    const visualizationType = this.state.visualizationType;
    return new SceneFlexItem({
      height: 'calc(100vh - 220px)',
      body: PanelBuilders.logs()
        .setTitle('Logs')
        .setOption('showLogContextToggle', true)
        .setOption('showTime', true)
        .setHeaderActions(
          <LogsPanelHeaderActions vizType={visualizationType} onChange={this.setVisualizationType.bind(this)} />
        )
        .build(),
    });
  }

  public setVisualizationType(type: LogsVisualizationType) {
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
        this.state.visualizationType === 'logs'
          ? this.getLogsPanel()
          : new SceneFlexItem({
              height: 'calc(100vh - 220px)',
              body: new LogsTableScene({}),
            }),
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
