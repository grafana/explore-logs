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
}

// Values/callbacks passed into react table component from scene
export interface TablePanelProps {
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}

export type LogsVisualizationType = 'logs' | 'table';
// If we use the local storage key from explore the user will get more consistent UX?
const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType:
        // (localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) as LogsVisualizationType) ?? 'table',
        'logs',
    });

    this.addActivationHandler(this._onActivate.bind(this));
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

    return new SceneFlexItem({
      height: 'calc(100vh - 220px)',
      body: new VizPanel({
        pluginId: LOGS_TABLE_PLUGIN_ID,
        options: {
          filters: fields.state.filters,
          addFilter,
          // @todo selected line should be moved to table scene,
          // @todo timerange should be moved to table scene
        },
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
    console.log('type', type);
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
