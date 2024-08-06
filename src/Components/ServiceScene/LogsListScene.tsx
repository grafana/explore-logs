import React from 'react';

import {
  AdHocFiltersVariable,
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
import { LineFilterScene } from './LineFilterScene';
import { SelectedTableRow } from '../Table/LogLineCellComponent';
import { LogsTableScene } from './LogsTableScene';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { LogsVolumePanel } from './LogsVolumePanel';
import { css } from '@emotion/css';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { DataFrame } from '@grafana/data';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { getLabelTypeFromFrame, LabelType } from 'services/fields';
import { getAdHocFiltersVariable, VAR_FIELDS, VAR_LABELS, VAR_LEVELS } from 'services/variables';
import { locationService } from '@grafana/runtime';
import { LogOptionsScene } from './LogOptionsScene';
import { getLogOption } from 'services/store';

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

  private handleLabelFilter(key: string, value: string, frame: DataFrame | undefined, operator: FilterType) {
    // @TODO: NOOP. We need a way to let the user know why this is not possible.
    if (key === 'service_name') {
      return;
    }
    const type = frame ? getLabelTypeFromFrame(key, frame) : LabelType.Parsed;
    const variableName = type === LabelType.Indexed ? VAR_LABELS : VAR_FIELDS;
    addToFilters(key, value, operator, this, variableName);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
      {
        filterType: variableName,
        key,
        action: operator,
      }
    );
  }

  public handleLabelFilterClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'toggle');
  };

  public handleLabelFilterOutClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'exclude');
  };

  public handleIsFilterLabelActive = (key: string, value: string) => {
    const labels = getAdHocFiltersVariable(VAR_LABELS, this);
    const fields = getAdHocFiltersVariable(VAR_FIELDS, this);
    const levels = getAdHocFiltersVariable(VAR_LEVELS, this);

    const hasKeyValueFilter = (filter: AdHocFiltersVariable | null) =>
      filter &&
      filter.state.filters.findIndex(
        (filter) => filter.operator === '=' && filter.key === key && filter.value === value
      ) >= 0;

    return hasKeyValueFilter(labels) || hasKeyValueFilter(fields) || hasKeyValueFilter(levels);
  };

  public handleFilterStringClick = (value: string) => {
    if (this.lineFilterScene) {
      this.lineFilterScene.updateFilter(value);
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  public updateLogsPanel = () => {
    this.setState({
      panel: this.getVizPanel(),
    });
  };

  private getLogsPanel() {
    const visualizationType = this.state.visualizationType;

    return new SceneFlexItem({
      height: 'calc(100vh - 220px)',
      body: PanelBuilders.logs()
        .setTitle('Logs')
        .setOption('showTime', true)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterLabel', this.handleLabelFilterClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterString', this.handleFilterStringClick)
        .setOption('wrapLogMessage', Boolean(getLogOption('wrapLines')))
        .setOption('showLogContextToggle', true)
        .setHeaderActions(<LogsPanelHeaderActions vizType={visualizationType} onChange={this.setVisualizationType} />)
        .build(),
    });
  }

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
              this.getLogsPanel(),
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
