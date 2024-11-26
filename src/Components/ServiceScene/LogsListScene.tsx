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
import { css } from '@emotion/css';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { locationService } from '@grafana/runtime';
import { LogsPanelScene } from './LogsPanelScene';
import {
  getDisplayedFields,
  getLogsVisualizationType,
  LogsVisualizationType,
  setLogsVisualizationType,
} from 'services/store';
import { logger } from '../../services/logger';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  visualizationType: LogsVisualizationType;
  urlColumns?: string[];
  selectedLine?: SelectedTableRow;
  $timeRange?: SceneTimeRangeLike;
  displayedFields: string[];
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['urlColumns', 'selectedLine', 'visualizationType', 'displayedFields'],
  });
  private lineFilterScene?: LineFilterScene = undefined;
  private logsPanelScene?: LogsPanelScene = undefined;
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType: getLogsVisualizationType(),
      displayedFields: [],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  getUrlState() {
    const urlColumns = this.state.urlColumns ?? [];
    const selectedLine = this.state.selectedLine;
    const visualizationType = this.state.visualizationType;
    const displayedFields = this.state.displayedFields ?? getDisplayedFields(this) ?? [];
    return {
      urlColumns: JSON.stringify(urlColumns),
      selectedLine: JSON.stringify(selectedLine),
      visualizationType: JSON.stringify(visualizationType),
      displayedFields: JSON.stringify(displayedFields),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    try {
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

      if (typeof values.displayedFields === 'string') {
        const displayedFields = JSON.parse(values.displayedFields);
        if (displayedFields && displayedFields.length) {
          stateUpdate.displayedFields = displayedFields;
        }
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogsListScene: updateFromUrl unexpected error' });
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
  }

  clearSelectedLine() {
    this.setState({
      selectedLine: undefined,
    });
  }

  clearDisplayedFields = () => {
    this.setState({ displayedFields: [] });
    if (this.logsPanelScene) {
      this.logsPanelScene.clearDisplayedFields();
    }
  };

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
    const selectedLineUrl = searchParams.get('selectedLine');
    const urlColumnsUrl = searchParams.get('urlColumns');
    const vizTypeUrl = searchParams.get('visualizationType');
    const displayedFieldsUrl = searchParams.get('displayedFields') ?? JSON.stringify(getDisplayedFields(this));

    this.updateFromUrl({
      selectedLine: selectedLineUrl,
      urlColumns: urlColumnsUrl,
      vizType: vizTypeUrl,
      displayedFields: displayedFieldsUrl,
    });
  }

  public setLogsVizOption = (options: Partial<Options> = {}) => {
    if (this.logsPanelScene) {
      this.logsPanelScene.setLogsVizOption(options);
    }
  };

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
    setLogsVisualizationType(type);
  };

  private getVizPanel() {
    this.lineFilterScene = new LineFilterScene();
    this.logsPanelScene = new LogsPanelScene({});

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
                ],
              }),
              new SceneFlexItem({
                height: 'calc(100vh - 220px)',
                body: this.logsPanelScene,
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
