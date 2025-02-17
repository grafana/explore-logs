import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { DataFrame, getValueFormat, LoadingState, LogRowModel } from '@grafana/data';
import { getLogOption, setDisplayedFields } from '../../services/store';
import React, { MouseEvent } from 'react';
import { LogsListScene } from './LogsListScene';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { getVariableForLabel } from '../../services/fields';
import { VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from '../../services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import {
  getAdHocFiltersVariable,
  getLineFiltersVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { copyText, generateLogShortlink, resolveRowTimeRangeForSharing } from 'services/text';
import { CopyLinkButton } from './CopyLinkButton';
import { getLogsPanelSortOrderFromStore, LogOptionsScene } from './LogOptionsScene';
import { LogsVolumePanel, logsVolumePanelKey } from './LogsVolumePanel';
import { getPanelWrapperStyles, PanelMenu } from '../Panels/PanelMenu';
import { ServiceScene } from './ServiceScene';
import { LineFilterCaseSensitive, LineFilterOp } from '../../services/filterTypes';
import { Options } from '@grafana/schema/dist/esm/raw/composable/logs/panelcfg/x/LogsPanelCfg_types.gen';
import { locationService } from '@grafana/runtime';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { logger } from '../../services/logger';
import { LogsSortOrder } from '@grafana/schema';
import { getPrettyQueryExpr } from 'services/scenes';
import { LogsPanelError } from './LogsPanelError';
import { clearVariables } from 'services/variableHelpers';

interface LogsPanelSceneState extends SceneObjectState {
  body?: VizPanel<Options>;
  error?: string;
  sortOrder?: LogsSortOrder;
  wrapLogMessage?: boolean;
}

export class LogsPanelScene extends SceneObjectBase<LogsPanelSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: ['sortOrder', 'wrapLogMessage'],
  });

  constructor(state: Partial<LogsPanelSceneState>) {
    super({
      sortOrder: getLogsPanelSortOrderFromStore(),
      wrapLogMessage: Boolean(getLogOption<boolean>('wrapLogMessage', false)),
      error: undefined,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private setStateFromUrl() {
    const searchParams = new URLSearchParams(locationService.getLocation().search);

    this.updateFromUrl({
      sortOrder: searchParams.get('sortOrder'),
      wrapLogMessage: searchParams.get('wrapLogMessage'),
    });
  }

  getUrlState() {
    return {
      sortOrder: JSON.stringify(this.state.sortOrder),
      wrapLogMessage: JSON.stringify(this.state.wrapLogMessage),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsPanelSceneState> = {};
    try {
      if (typeof values.sortOrder === 'string' && values.sortOrder) {
        const decodedSortOrder = narrowLogsSortOrder(JSON.parse(values.sortOrder));
        if (decodedSortOrder) {
          stateUpdate.sortOrder = decodedSortOrder;
          this.setLogsVizOption({ sortOrder: decodedSortOrder });
        }
      }

      if (typeof values.wrapLogMessage === 'string' && values.wrapLogMessage) {
        const decodedWrapLogMessage = JSON.parse(values.wrapLogMessage);
        if (typeof decodedWrapLogMessage === 'boolean') {
          stateUpdate.wrapLogMessage = decodedWrapLogMessage;
          this.setLogsVizOption({ wrapLogMessage: decodedWrapLogMessage });
          this.setLogsVizOption({ prettifyLogMessage: decodedWrapLogMessage });
        }
      }
    } catch (e) {
      // URL Params can be manually changed and it will make JSON.parse() fail.
      logger.error(e, { msg: 'LogOptionsScene: updateFromUrl unexpected error' });
    }

    if (Object.keys(stateUpdate).length) {
      this.setState({ ...stateUpdate });
    }
  }

  public onActivate() {
    // Need viz to set options, but setting options will trigger query
    this.setStateFromUrl();

    if (!this.state.body) {
      this.setState({
        body: this.getLogsPanel({
          wrapLogMessage: this.state.wrapLogMessage,
          prettifyLogMessage: this.state.wrapLogMessage,
          sortOrder: this.state.sortOrder,
        }),
      });
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (newState.$data?.state.data?.state === LoadingState.Error) {
          const error = newState.$data?.state.data.errors?.length
            ? newState.$data?.state.data.errors[0].message
            : newState.$data?.state.data.error?.message;
          this.setState({ error });
        } else if (this.state.error) {
          this.setState({ error: undefined });
        }
        if (newState.logsCount !== prevState.logsCount) {
          if (!this.state.body) {
            this.setState({
              body: this.getLogsPanel({
                wrapLogMessage: this.state.wrapLogMessage,
                prettifyLogMessage: this.state.wrapLogMessage,
                sortOrder: this.state.sortOrder,
              }),
            });
          } else {
            this.state.body.setState({
              title: this.getTitle(newState.logsCount),
            });
          }
        }
      })
    );
  }

  onClickShowField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index === -1 && this.state.body) {
      const displayedFields = [...parent.state.displayedFields, field];
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, parent.state.displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  onClickHideField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index >= 0 && this.state.body) {
      const displayedFields = parent.state.displayedFields.filter((displayedField) => field !== displayedField);
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, parent.state.displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  setLogsVizOption(options: Partial<Options> = {}) {
    if (!this.state.body) {
      return;
    }
    if ('sortOrder' in options && options.sortOrder !== this.state.body.state.options.sortOrder) {
      const $data = sceneGraph.getData(this);
      const queryRunner =
        $data instanceof SceneQueryRunner ? $data : sceneGraph.findDescendents($data, SceneQueryRunner)[0];
      if (queryRunner) {
        queryRunner.runQueries();
      }
    }
    this.state.body.onOptionsChange(options);
  }

  clearDisplayedFields = () => {
    if (!this.state.body) {
      return;
    }
    this.setLogsVizOption({
      displayedFields: [],
    });
    setDisplayedFields(this, []);
  };

  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  private getTitle(logsCount: number | undefined) {
    const valueFormatter = getValueFormat('short');
    const formattedCount = logsCount !== undefined ? valueFormatter(logsCount, 0) : undefined;
    return formattedCount !== undefined ? `Logs (${formattedCount.text}${formattedCount.suffix?.trim()})` : 'Logs';
  }

  private getLogsPanel(options: Partial<Options>) {
    const parentModel = this.getParentScene();
    const visualizationType = parentModel.state.visualizationType;
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    return (
      PanelBuilders.logs()
        .setTitle(this.getTitle(serviceScene.state.logsCount))
        .setOption('showTime', true)
        .setOption('onClickFilterLabel', this.handleLabelFilterClick)
        .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
        .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
        .setOption('onClickFilterString', this.handleFilterStringClick)
        .setOption('onClickFilterOutString', this.handleFilterOutStringClick)
        .setOption('onClickShowField', this.onClickShowField)
        .setOption('onClickHideField', this.onClickHideField)
        .setOption('displayedFields', parentModel.state.displayedFields)
        .setOption('sortOrder', options.sortOrder ?? getLogsPanelSortOrderFromStore())
        .setOption('wrapLogMessage', options.wrapLogMessage ?? Boolean(getLogOption<boolean>('wrapLogMessage', false)))
        .setOption(
          'prettifyLogMessage',
          options.prettifyLogMessage ?? Boolean(getLogOption<boolean>('wrapLogMessage', false))
        )
        .setMenu(
          new PanelMenu({
            investigationOptions: { type: 'logs', getLabelName: () => `Logs: ${getPrettyQueryExpr(serviceScene)}` },
          })
        )
        .setOption('showLogContextToggle', true)
        // @ts-expect-error Requires Grafana 11.5
        .setOption('enableInfiniteScrolling', true)
        // @ts-expect-error Grafana 11.5
        .setOption('onNewLogsReceived', this.updateVisibleRange)
        // @ts-expect-error Grafana 11.5
        .setOption('logRowMenuIconsAfter', [<CopyLinkButton onClick={this.handleShareLogLineClick} key={0} />])

        .setHeaderActions(
          new LogOptionsScene({ visualizationType, onChangeVisualizationType: parentModel.setVisualizationType })
        )
        .build()
    );
  }

  private updateVisibleRange = (newLogs: DataFrame[]) => {
    // Update logs count
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    serviceScene.setState({
      logsCount: newLogs[0].length,
    });

    if (serviceScene.state.$data?.state.data?.series) {
      // We need to update the state with the new data without triggering state-dependent changes.
      serviceScene.state.$data.setState({
        ...serviceScene.state.$data.state,
        data: {
          ...serviceScene.state.$data.state.data,
          series: newLogs,
        },
      });
    }

    const logsVolumeScene = sceneGraph.findByKeyAndType(this, logsVolumePanelKey, LogsVolumePanel);
    logsVolumeScene.updateVisibleRange(newLogs);
  };

  private handleShareLogLineClick = (event: MouseEvent<HTMLElement>, row?: LogRowModel) => {
    if (row?.rowId && this.state.body) {
      const parent = this.getParentScene();
      const timeRange = resolveRowTimeRangeForSharing(row);
      copyText(
        generateLogShortlink(
          'panelState',
          {
            logs: { id: row.uid, displayedFields: parent.state.displayedFields },
          },
          timeRange
        )
      );
    }
  };

  private handleLabelFilterClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'toggle');
  };

  private handleLabelFilterOutClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'exclude');
  };

  private handleIsFilterLabelActive = (key: string, value: string) => {
    const labels = getAdHocFiltersVariable(VAR_LABELS, this);
    const fields = getAdHocFiltersVariable(VAR_FIELDS, this);
    const levels = getAdHocFiltersVariable(VAR_LEVELS, this);
    const metadata = getAdHocFiltersVariable(VAR_METADATA, this);

    const hasKeyValueFilter = (filter: AdHocFiltersVariable | null) => {
      return (
        filter &&
        filter.state.filters.findIndex(
          (filter) => filter.operator === '=' && filter.key === key && filter.value === value
        ) >= 0
      );
    };

    // Fields have json encoded values unlike the other variables, get the value for the matching filter and parse it before comparing
    const hasKeyValueFilterField = (filter: AdHocFiltersVariable | null) => {
      if (filter) {
        const fieldFilter = filter.state.filters.find((filter) => filter.operator === '=' && filter.key === key);

        if (fieldFilter) {
          const fieldValue = getValueFromFieldsFilter(fieldFilter, key);
          return fieldValue.value === value;
        }
      }
      return false;
    };

    return (
      hasKeyValueFilter(labels) ||
      hasKeyValueFilterField(fields) ||
      hasKeyValueFilter(levels) ||
      hasKeyValueFilter(metadata)
    );
  };

  private handleFilterOutStringClick = (value: string) => {
    const lineFiltersVar = getLineFiltersVariable(this);
    if (lineFiltersVar) {
      lineFiltersVar.setState({
        filters: [
          ...lineFiltersVar.state.filters,
          {
            operator: LineFilterOp.negativeMatch,
            value,
            key: LineFilterCaseSensitive.caseSensitive,
            keyLabel: lineFiltersVar.state.filters.length.toString(),
          },
        ],
      });
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  private handleFilterStringClick = (value: string) => {
    const lineFiltersVar = getLineFiltersVariable(this);
    if (lineFiltersVar) {
      lineFiltersVar.setState({
        filters: [
          ...lineFiltersVar.state.filters,
          {
            operator: LineFilterOp.match,
            value,
            key: LineFilterCaseSensitive.caseSensitive,
            keyLabel: lineFiltersVar.state.filters.length.toString(),
          },
        ],
      });
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  private handleLabelFilter(key: string, value: string, frame: DataFrame | undefined, operator: FilterType) {
    const variableType = getVariableForLabel(frame, key, this);

    addToFilters(key, value, operator, this, variableType);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
      {
        filterType: variableType,
        key,
        action: operator,
      }
    );
  }

  public static Component = ({ model }: SceneComponentProps<LogsPanelScene>) => {
    const { body, error } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (body) {
      return (
        <span className={styles.panelWrapper}>
          {!error && <body.Component model={body} />}
          {error && <LogsPanelError error={error} clearFilters={() => clearVariables(body)} />}
        </span>
      );
    }
    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
