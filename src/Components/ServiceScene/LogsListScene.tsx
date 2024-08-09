import React from 'react';

import {
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRangeLike,
} from '@grafana/scenes';
import { LineFilterScene } from './LineFilterScene';
import { SelectedTableRow } from '../Table/LogLineCellComponent';
import { LogsTableScene } from './LogsTableScene';
import { LogsVolumePanel } from './LogsVolumePanel';
import { css } from '@emotion/css';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { locationService } from '@grafana/runtime';
import { LogOptionsScene } from './LogOptionsScene';
import { LogsPanelScene } from './LogsPanelScene';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  visualizationType: LogsVisualizationType;
  urlColumns?: string[];
  selectedLine?: SelectedTableRow;
  $timeRange?: SceneTimeRangeLike;
}

export type LogsVisualizationType = 'logs' | 'table';
// If we use the local storage key from explore the user will get more consistent UX?
const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['urlColumns', 'selectedLine', 'visualizationType'],
  });
  private lineFilterScene?: LineFilterScene = undefined;
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType: (localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) as LogsVisualizationType) ?? 'logs',
    });

    this.addActivationHandler(this.onActivate.bind(this));
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

  clearSelectedLine() {
    this.setState({
      selectedLine: undefined,
    });
  }

  public onActivate() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);
    this.setStateFromUrl(searchParams);

    if (!this.state.panel) {
      this.updateLogsPanel();
    }

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.visualizationType !== prevState.visualizationType) {
          this.updateLogsPanel();
        }
      })
    );
  }

  public getLineFilterScene() {
    return this.lineFilterScene;
  }

  private setStateFromUrl(searchParams: URLSearchParams) {
    const state: Partial<LogsListSceneState> = {};
    const selectedLineUrl = searchParams.get('selectedLine');
    const urlColumnsUrl = searchParams.get('urlColumns');
    const vizTypeUrl = searchParams.get('visualizationType');

    if (selectedLineUrl) {
      state.selectedLine = JSON.parse(selectedLineUrl);
    }
    if (urlColumnsUrl) {
      state.urlColumns = JSON.parse(urlColumnsUrl);
    }
    if (vizTypeUrl) {
      state.visualizationType = JSON.parse(vizTypeUrl);
    }

    // If state is saved in url on activation, save to scene state
    if (Object.keys(state).length) {
      this.setState(state);
    }
  }

  public updateLogsPanel = () => {
    this.setState({
      panel: this.getVizPanel(),
    });
  };

  public setVisualizationType = (type: LogsVisualizationType) => {
    this.setState({
      visualizationType: type,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_visualization_toggle,
      {
        visualisationType: type,
      }
    );
    localStorage.setItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY, type);
  };

  private getVizPanel() {
    this.lineFilterScene = new LineFilterScene();

    return new SceneFlexLayout({
      direction: 'column',
      children:
        this.state.visualizationType === 'logs'
          ? [
              new SceneFlexLayout({
                children: [
                  new SceneFlexItem({
                    body: this.lineFilterScene,
                    xSizing: 'fill',
                  }),
                  new LogOptionsScene(),
                ],
              }),
              new SceneFlexItem({
                height: 'calc(100vh - 220px)',
                body: new LogsPanelScene({}),
              }),
            ]
          : [
              new SceneFlexItem({
                body: this.lineFilterScene,
                xSizing: 'fill',
              }),
              new SceneFlexItem({
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

    return (
      <div className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </div>
    );
  };
}

export function buildLogsListScene() {
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        minHeight: 200,
        body: new LogsVolumePanel({}),
      }),
      new SceneFlexItem({
        minHeight: '470px',
        height: 'calc(100vh - 500px)',
        body: new LogsListScene({}),
      }),
    ],
  });
}

const styles = {
  panelWrapper: css({
    // If you use hover-header without any header options we must manually hide the remnants, or it shows up as a 1px line in the top-right corner of the viz
    '.show-on-hover': {
      display: 'none',
    },

    // Hack to select internal div
    'section > div[class$="panel-content"]': css({
      // A components withing the Logs viz sets contain, which creates a new containing block that is not body which breaks the popover menu
      contain: 'none',
      // Prevent overflow from spilling out of parent container
      overflow: 'auto',
    }),
  }),
};
