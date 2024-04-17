import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { LineFilter } from '../LineFilter';
import { getTablePanel } from '@/components/Explore/panels/tablePanel';
import { VAR_FIELDS } from '@/utils/shared';
import { AdHocVariableFilter, TimeRange } from '@grafana/data';
import { SelectedTableRow } from '@/components/Table/LogLineCellComponent';
import { getLogsPanel } from '@/components/Explore/panels/logsPanel';

export type LogsVisualizationType = 'logs' | 'table';
// If we use the local storage key from explore the user will get more consistent UX
const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';
export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  selectedLine?: SelectedTableRow;
  visualizationType: LogsVisualizationType;
  timeRange?: TimeRange;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['selectedLine'] });

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType:
        (localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) as LogsVisualizationType) ?? 'table',
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };

  getUrlState() {
    let stateUpdate: Partial<{
      selectedLine?: string;
    }> = {};
    if (this.state.selectedLine) {
      stateUpdate.selectedLine = JSON.stringify(this.state.selectedLine);
    }
    return stateUpdate;
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    // Selected line
    if (typeof values.selectedLine === 'string') {
      const selectedLine = JSON.parse(values.selectedLine);
      if (selectedLine !== this.state.selectedLine) {
        stateUpdate.selectedLine = selectedLine;
      }
    }

    if (stateUpdate) {
      this.setState(stateUpdate);
    }
  }

  public _onActivate() {
    const addFilter = (filter: AdHocVariableFilter) => {
      const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
      const filters = fields.state.filters;
      fields.setState({
        filters: [...filters, filter],
      });
    };

    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
        this.setState({
          timeRange: newState.value,
        });
      })
    );

    if (!this.state.panel) {
      const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
      const range = sceneGraph.getTimeRange(this).state.value;
      this.setPanelState(fields.state.filters, addFilter, range);
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (
          newState.visualizationType !== prevState.visualizationType ||
          newState.timeRange !== prevState.timeRange ||
          newState.selectedLine !== prevState.selectedLine
        ) {
          const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
          const range = sceneGraph.getTimeRange(this).state.value;
          const filters = fields.state.filters;
          this.setPanelState(filters, addFilter, range);
        }
      })
    );
  }

  private setPanelState(
    filters: AdHocVariableFilter[],
    addFilter: (filter: AdHocVariableFilter) => void,
    range: TimeRange
  ) {
    this.setState({
      panel: this.getVizPanel({
        filters,
        addFilter,
        selectedLine: this.state.selectedLine,
        timeRange: range,
      }),
    });
  }

  private setVisualizationType(type: LogsVisualizationType) {
    this.setState({
      visualizationType: type,
    });
    localStorage.setItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY, type);
  }

  private getVizPanel(props: TablePanelProps) {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new LineFilter(),
          ySizing: 'content',
        }),
        new SceneFlexItem({
          height: 'calc(100vh - 220px)',
          body:
            this.state.visualizationType === 'table'
              ? getTablePanel(props, {
                  vizType: this.state.visualizationType,
                  setVizType: this.setVisualizationType.bind(this),
                })
              : getLogsPanel({
                  vizType: this.state.visualizationType,
                  setVizType: this.setVisualizationType.bind(this),
                }),
        }),
      ],
    });
  }
}

// Values/callbacks passed into react table component from scene
export interface TablePanelProps {
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({}),
  });
}
