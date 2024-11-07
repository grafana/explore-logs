import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';
import {
  AdHocVariableFilter,
  DashboardCursorSync,
  DataFrame,
  dateTime,
  GrafanaTheme2,
  LoadingState,
  TimeRange,
} from '@grafana/data';
import {
  AdHocFiltersVariable,
  behaviors,
  DataSourceVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import {
  DrawStyle,
  Field,
  IconButton,
  LegendDisplayMode,
  PanelContext,
  SeriesVisibilityChangeMode,
  StackingMode,
  useStyles2,
} from '@grafana/ui';
import { addTabToLocalStorage, getFavoriteLabelValuesFromStorage } from 'services/store';
import {
  EXPLORATION_DS,
  LEVEL_VARIABLE_VALUE,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_AGGREGATED_METRICS,
  VAR_LABELS_REPLICA,
  VAR_LABELS_REPLICA_EXPR,
  VAR_PRIMARY_LABEL,
  VAR_PRIMARY_LABEL_EXPR,
  VAR_PRIMARY_LABEL_SEARCH,
} from 'services/variables';
import { selectLabel, SelectServiceButton } from './SelectServiceButton';
import { buildDataQuery, buildVolumeQuery, renderLogQLLabelFilters } from 'services/query';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getQueryRunner, getSceneQueryRunner, setLevelColorOverrides } from 'services/panel';
import { ConfigureVolumeError } from './ConfigureVolumeError';
import { NoServiceSearchResults } from './NoServiceSearchResults';
import { getLabelsFromSeries, toggleLevelVisibility } from 'services/levels';
import { ServiceFieldSelector } from '../ServiceScene/Breakdowns/FieldSelector';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import { areArraysEqual } from '../../services/comparison';
import {
  clearServiceSelectionSearchVariable,
  getAggregatedMetricsVariable,
  getDataSourceVariable,
  getLabelsVariable,
  getLabelsVariableReplica,
  getServiceSelectionPrimaryLabel,
  getServiceSelectionSearchVariable,
  setServiceSelectionPrimaryLabelKey,
} from '../../services/variableGetters';
import { config, locationService } from '@grafana/runtime';
import { VariableHide } from '@grafana/schema';
import { ToolbarScene } from '../IndexScene/ToolbarScene';
import { IndexScene } from '../IndexScene/IndexScene';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';
import { FavoriteServiceHeaderActionScene } from './FavoriteServiceHeaderActionScene';
import { pushUrlHandler } from '../../services/navigate';
import { NoServiceVolume } from './NoServiceVolume';
import { getQueryRunnerFromChildren } from '../../services/scenes';
import { AddLabelToFiltersHeaderActionScene } from './AddLabelToFiltersHeaderActionScene';

const aggregatedMetricsEnabled: boolean | undefined = config.featureToggles.exploreLogsAggregatedMetrics;
// Don't export AGGREGATED_SERVICE_NAME, we want to rename things so the rest of the application is agnostic to how we got the services
const AGGREGATED_SERVICE_NAME = '__aggregated_metric__';

//@todo make start date user configurable, currently hardcoded for experimental cloud release
export const AGGREGATED_METRIC_START_DATE = dateTime('2024-08-30', 'YYYY-MM-DD');
export const SERVICES_LIMIT = 20;

interface ServiceSelectionSceneState extends SceneObjectState {
  // The body of the component
  body: SceneCSSGridLayout;
  // Show logs of a certain level for a given service
  serviceLevel: Map<string, string[]>;
  // Logs volume API response as dataframe with SceneQueryRunner
  $data: SceneQueryRunner;
  tabs?: ServiceSelectionTabsScene;
  showPopover: boolean;
  tabOptions: Array<{
    label: string;
    value: string;
  }>;
}

function renderPrimaryLabelFilters(filters: AdHocVariableFilter[]): string {
  if (filters.length) {
    const filter = filters[0];
    return `${filter.key}${filter.operator}\`${filter.value}\``;
  }

  return '';
}

const primaryLabelUrlKey = 'var-primary_label';
const datasourceUrlKey = 'var-ds';

export class ServiceSelectionScene extends SceneObjectBase<ServiceSelectionSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, {
    keys: [primaryLabelUrlKey],
  });

  constructor(state: Partial<ServiceSelectionSceneState>) {
    super({
      body: new SceneCSSGridLayout({ children: [] }),
      $variables: new SceneVariableSet({
        variables: [
          // Service search variable
          new CustomConstantVariable({
            name: VAR_PRIMARY_LABEL_SEARCH,
            label: 'Service',
            hide: VariableHide.hideVariable,
            skipUrlSync: true,
            value: '.+',
          }),
          // variable that stores if aggregated metrics are supported for the query
          new CustomConstantVariable({
            name: VAR_AGGREGATED_METRICS,
            label: '',
            hide: VariableHide.hideLabel,
            value: SERVICE_NAME,
            skipUrlSync: true,
            options: [
              {
                value: SERVICE_NAME,
                label: SERVICE_NAME,
              },
              {
                value: AGGREGATED_SERVICE_NAME,
                label: AGGREGATED_SERVICE_NAME,
              },
            ],
          }),
          // The active tab expression, hidden variable
          // @todo need to move top-level?
          new AdHocFiltersVariable({
            name: VAR_PRIMARY_LABEL,
            hide: VariableHide.hideLabel,
            expressionBuilder: (filters) => {
              return renderPrimaryLabelFilters(filters);
            },
            filters: [
              {
                key: getSelectedTabFromUrl().key ?? SERVICE_NAME,
                value: '.+',
                operator: '=~',
              },
            ],
          }),
          new AdHocFiltersVariable({
            name: VAR_LABELS_REPLICA,
            datasource: EXPLORATION_DS,
            layout: 'vertical',
            filters: [],
            expressionBuilder: renderLogQLLabelFilters,
            hide: VariableHide.hideVariable,
            key: 'adhoc_service_filter_replica',
            skipUrlSync: true,
          }),
        ],
      }),
      $data: getSceneQueryRunner({
        queries: [],
        runQueriesMode: 'manual',
      }),
      serviceLevel: new Map<string, string[]>(),

      showPopover: false,
      tabOptions: [
        {
          label: SERVICE_UI_LABEL,
          value: SERVICE_NAME,
        },
      ],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  /**
   * Set changes from the URL to the state of the primary label variable
   */
  getUrlState() {
    const { key } = getSelectedTabFromUrl();
    const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
    const filter = primaryLabelVar.state.filters[0];

    if (filter.key && filter.key !== key) {
      getServiceSelectionPrimaryLabel(this).setState({
        filters: [
          {
            ...filter,
            key: key ?? filter.key,
          },
        ],
      });
    }

    return {};
  }

  /**
   * Unused, but required
   * @param values
   */
  updateFromUrl(values: SceneObjectUrlValues) {}

  addDatasourceChangeToBrowserHistory(newDs: string) {
    const location = locationService.getLocation();
    const search = new URLSearchParams(location.search);
    const dsUrl = search.get(datasourceUrlKey);
    if (dsUrl && newDs !== dsUrl) {
      const currentUrl = location.pathname + location.search;
      search.set(datasourceUrlKey, newDs);
      const newUrl = location.pathname + '?' + search.toString();
      if (currentUrl !== newUrl) {
        pushUrlHandler(newUrl);
      }
    }
  }

  /**
   * Attempting to add any change to the primary label variable (i.e. the selected tab) as a browser history event
   * @param newKey
   * @param replace
   */
  addLabelChangeToBrowserHistory(newKey: string, replace = false) {
    const { key: primaryLabelRaw, search, location } = getSelectedTabFromUrl();
    if (primaryLabelRaw) {
      const primaryLabelSplit = primaryLabelRaw?.split('|');
      const keyInUrl = primaryLabelSplit?.[0];

      if (keyInUrl !== newKey) {
        primaryLabelSplit[0] = newKey;
        search.set(primaryLabelUrlKey, primaryLabelSplit.join('|'));
        const currentUrl = location.pathname + location.search;
        const newUrl = location.pathname + '?' + search.toString();
        if (currentUrl !== newUrl) {
          if (replace) {
            locationService.replace(newUrl);
          } else {
            pushUrlHandler(newUrl);
          }
        }
      }
    }
  }

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionScene>) => {
    const styles = useStyles2(getStyles);
    const { body, $data, tabs } = model.useState();
    const { data } = $data.useState();
    const selectedTab = model.getSelectedTab();

    const serviceStringVariable = getServiceSelectionSearchVariable(model);
    const { label, value: searchValue } = serviceStringVariable.useState();
    const hasSearch = searchValue && searchValue !== '.+';

    const { labelsByVolume, labelsToQuery } = model.getLabels(data?.series);
    const isLogVolumeLoading =
      data?.state === LoadingState.Loading || data?.state === LoadingState.Streaming || data === undefined;
    const volumeApiError = $data.state.data?.state === LoadingState.Error;

    const onSearchChange = (serviceName?: string) => {
      model.onSearchServicesChange(serviceName);
    };
    const totalServices = labelsToQuery?.length ?? 0;
    // To get the count of services that are currently displayed, divide the number of panels by 2, as there are 2 panels per service (logs and time series)
    const renderedServices = body.state.children.length / 2;

    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          {tabs && <tabs.Component model={tabs} />}
          <Field className={styles.searchField}>
            <div className={styles.searchWrapper}>
              <ServiceFieldSelector
                initialFilter={{
                  label: model.unwrapWildcardSearch(serviceStringVariable.getValue().toString()),
                  value: serviceStringVariable.getValue().toString(),
                  icon: 'filter',
                }}
                isLoading={isLogVolumeLoading}
                value={label}
                onChange={(serviceName) => onSearchChange(serviceName)}
                selectOption={(value: string) => {
                  selectLabel(selectedTab, value, model);
                }}
                label={model.formatPrimaryLabelForUI()}
                options={
                  labelsToQuery?.map((serviceName) => ({
                    value: serviceName,
                    label: serviceName,
                  })) ?? []
                }
              />
              {!isLogVolumeLoading && (
                <span className={styles.searchFieldPlaceholderText}>
                  Showing {renderedServices} of {totalServices}{' '}
                  <IconButton
                    className={styles.icon}
                    aria-label="Count info"
                    name={'info-circle'}
                    tooltip={`${totalServices} labels have values for the selected time range. Total label count may differ`}
                  />
                </span>
              )}
            </div>
          </Field>
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isLogVolumeLoading && volumeApiError && <ConfigureVolumeError />}
          {!isLogVolumeLoading && !volumeApiError && hasSearch && !labelsByVolume?.length && <NoServiceSearchResults />}
          {!isLogVolumeLoading && !volumeApiError && !hasSearch && !labelsByVolume?.length && (
            <NoServiceVolume labelName={selectedTab} />
          )}
          {!(!isLogVolumeLoading && volumeApiError) && (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </div>
    );
  };

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  onSearchServicesChange = debounce((primaryLabelSearch?: string) => {
    // Set search variable
    const searchVar = getServiceSelectionSearchVariable(this);

    const newSearchString = primaryLabelSearch ? this.wrapWildcardSearch(primaryLabelSearch) : '.+';
    if (newSearchString !== searchVar.state.value) {
      searchVar.setState({
        value: primaryLabelSearch ? this.wrapWildcardSearch(primaryLabelSearch) : '.+',
        label: primaryLabelSearch ?? '',
      });
    }

    const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
    const filter = primaryLabelVar.state.filters[0];

    // Update primary label with search string
    if (this.wrapWildcardSearch(searchVar.state.value.toString()) !== filter.value) {
      primaryLabelVar.setState({
        filters: [
          {
            ...filter,
            value: this.wrapWildcardSearch(searchVar.state.value.toString()),
          },
        ],
      });
    }

    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.search_services_changed,
      {
        searchQuery: primaryLabelSearch,
      }
    );
  }, 500);

  getSelectedTab() {
    return getServiceSelectionPrimaryLabel(this).state.filters[0]?.key;
  }

  selectDefaultLabelTab() {
    // Need to update the history before the state with replace instead of push, or we'll get invalid services saved to url state after changing datasource
    this.addLabelChangeToBrowserHistory(SERVICE_NAME, true);
    this.setSelectedTab(SERVICE_NAME);
  }

  setSelectedTab(labelName: string) {
    addTabToLocalStorage(getDataSourceVariable(this).getValue().toString(), labelName);

    // clear active search
    clearServiceSelectionSearchVariable(this);

    // Update the primary label variable
    setServiceSelectionPrimaryLabelKey(labelName, this);
  }

  // Creates a layout with timeseries panel
  buildServiceLayout(
    primaryLabelName: string,
    primaryLabelValue: string,
    timeRange: TimeRange,
    serviceLabelVar: CustomConstantVariable,
    primaryLabelVar: AdHocFiltersVariable,
    datasourceVar: DataSourceVariable
  ) {
    let splitDuration;
    if (timeRange.to.diff(timeRange.from, 'hours') >= 4 && timeRange.to.diff(timeRange.from, 'hours') <= 26) {
      splitDuration = '2h';
    }
    const panel = PanelBuilders.timeseries()
      // If service was previously selected, we show it in the title
      .setTitle(primaryLabelValue)
      .setData(
        getQueryRunner(
          [
            buildDataQuery(this.getMetricExpression(primaryLabelValue, serviceLabelVar, primaryLabelVar), {
              legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
              splitDuration,
              refId: `ts-${primaryLabelValue}`,
            }),
          ],
          { runQueriesMode: 'manual' }
        )
      )
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setUnit('short')
      .setOverrides(setLevelColorOverrides)
      .setOption('legend', {
        showLegend: true,
        calcs: ['sum'],
        placement: 'right',
        displayMode: LegendDisplayMode.Table,
      })
      .setHeaderActions([
        new FavoriteServiceHeaderActionScene({
          ds: datasourceVar.getValue()?.toString(),
          labelName: primaryLabelName,
          labelValue: primaryLabelValue,
        }),
        new AddLabelToFiltersHeaderActionScene({
          name: primaryLabelName,
          value: primaryLabelValue,
        }),
        new SelectServiceButton({ labelValue: primaryLabelValue, labelName: primaryLabelName }),
      ])
      .build();

    panel.setState({
      extendPanelContext: (_, context) =>
        this.extendTimeSeriesLegendBus(primaryLabelName, primaryLabelValue, context, panel),
    });

    const cssGridItem = new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ key: 'serviceCrosshairSync', sync: DashboardCursorSync.Crosshair })],
      body: panel,
    });

    cssGridItem.addActivationHandler(() => {
      const runner = getQueryRunnerFromChildren(cssGridItem)[0];
      // If the query runner has already ran, the scene must be cached, don't re-run as the volume query will be triggered which will execute another panel query
      if (runner.state.data?.state !== LoadingState.Done) {
        this.runPanelQuery(cssGridItem);
      }
    });

    return cssGridItem;
  }

  isAggregatedMetricsActive() {
    const toolbar = this.getQueryOptionsToolbar();
    return !toolbar?.state.options.aggregatedMetrics.disabled && toolbar?.state.options.aggregatedMetrics.active;
  }

  getLevelFilterForService = (service: string) => {
    let serviceLevels = this.state.serviceLevel.get(service) || [];
    if (serviceLevels.length === 0) {
      return '';
    }
    const filters = serviceLevels.map((level) => {
      if (level === 'logs') {
        level = '';
      }
      return `${LEVEL_VARIABLE_VALUE}=\`${level}\``;
    });
    return ` | ${filters.join(' or ')} `;
  };

  // Creates a layout with logs panel
  buildServiceLogsLayout = (labelName: string, labelValue: string) => {
    const levelFilter = this.getLevelFilterForService(labelValue);
    const cssGridItem = new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
      body: PanelBuilders.logs()
        // Hover header set to true removes unused header padding, displaying more logs
        .setHoverHeader(true)
        .setData(
          getQueryRunner(
            [
              buildDataQuery(this.getLogExpression(labelName, labelValue, levelFilter), {
                maxLines: 100,
                refId: `logs-${labelValue}`,
              }),
            ],
            {
              runQueriesMode: 'manual',
            }
          )
        )
        .setTitle(labelValue)
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .build(),
    });

    cssGridItem.addActivationHandler(() => {
      const runner = getQueryRunnerFromChildren(cssGridItem)[0];
      // If the query runner has already ran, the scene must be cached, don't re-run as the volume query will be triggered which will execute another panel query
      if (runner.state.data?.state !== LoadingState.Done) {
        this.runPanelQuery(cssGridItem);
      }
    });

    return cssGridItem;
  };

  formatPrimaryLabelForUI() {
    const selectedTab = this.getSelectedTab();
    return selectedTab === SERVICE_NAME ? SERVICE_UI_LABEL : selectedTab;
  }

  private setVolumeQueryRunner() {
    this.setState({
      $data: getSceneQueryRunner({
        queries: [
          buildVolumeQuery(`{${VAR_PRIMARY_LABEL_EXPR}, ${VAR_LABELS_REPLICA_EXPR}}`, 'volume', this.getSelectedTab()),
        ],
        runQueriesMode: 'manual',
      }),
    });

    // Need to re-init any subscriptions since we changed the query runner
    this.subscribeToVolume();
  }

  private doVariablesNeedSync() {
    const labelsVarPrimary = getLabelsVariable(this);
    const labelsVarReplica = getLabelsVariableReplica(this);

    const activeTab = this.getSelectedTab();
    const filteredFilters = labelsVarPrimary.state.filters.filter((f) => f.key !== activeTab);

    return { filters: filteredFilters, needsSync: !areArraysEqual(filteredFilters, labelsVarReplica.state.filters) };
  }

  private syncVariables() {
    const labelsVarReplica = getLabelsVariableReplica(this);

    const { filters, needsSync } = this.doVariablesNeedSync();
    if (needsSync) {
      labelsVarReplica.setState({ filters });
    }
  }

  private onActivate() {
    this.fixRequiredUrlParams();

    // Sync initial state from primary labels to local replica
    this.syncVariables();

    // Clear existing volume data on activate or we'll show stale cached data, potentially from a different datasource
    this.setVolumeQueryRunner();

    // Subscribe to primary labels for further updates
    this.subscribeToPrimaryLabelsVariable();

    // Subscribe to variables replica
    this.subscribeToLabelFilterChanges();

    // Subscribe to tab changes (primary label)
    this.subscribeToActiveTabVariable(getServiceSelectionPrimaryLabel(this));

    if (this.state.$data.state.data?.state !== LoadingState.Done) {
      this.runVolumeOnActivate();
    }

    // Update labels on time range change
    this.subscribeToTimeRange();

    // Update labels on datasource change
    this.subscribeToDatasource();

    this.subscribeToAggregatedMetricToggle();

    this.subscribeToAggregatedMetricVariable();
  }

  private runVolumeOnActivate() {
    if (this.isTimeRangeTooEarlyForAggMetrics()) {
      this.onUnsupportedAggregatedMetricTimeRange();
      if (this.state.$data.state.data?.state !== LoadingState.Done) {
        this.runVolumeQuery();
      }
    } else {
      this.onSupportedAggregatedMetricTimeRange();
      if (this.state.$data.state.data?.state !== LoadingState.Done) {
        this.runVolumeQuery();
      }
    }
  }

  private subscribeToAggregatedMetricToggle() {
    this._subs.add(
      this.getQueryOptionsToolbar()?.subscribeToState((newState, prevState) => {
        if (newState.options.aggregatedMetrics.userOverride !== prevState.options.aggregatedMetrics.userOverride) {
          this.runVolumeQuery(true);
        }
      })
    );
  }

  private subscribeToDatasource() {
    this._subs.add(
      getDataSourceVariable(this).subscribeToState((newState) => {
        this.addDatasourceChangeToBrowserHistory(newState.value.toString());
        this.runVolumeQuery();
      })
    );
  }

  private subscribeToActiveTabVariable(primaryLabelVar: AdHocFiltersVariable) {
    this._subs.add(
      primaryLabelVar.subscribeToState((newState, prevState) => {
        if (newState.filterExpression !== prevState.filterExpression) {
          const newKey = newState.filters[0].key;
          this.addLabelChangeToBrowserHistory(newKey);
          // Need to tear down volume query runner to select other labels, as we need the selected tab to parse the volume response
          const { needsSync } = this.doVariablesNeedSync();

          if (needsSync) {
            this.syncVariables();
          } else {
            this.runVolumeQuery(true);
          }
        }
      })
    );
  }

  /**
   * agg metrics need parser and unwrap, have to tear down and rebuild panels when the variable changes
   * @private
   */
  private subscribeToAggregatedMetricVariable() {
    this._subs.add(
      getAggregatedMetricsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          // Clear the body panels
          this.setState({
            body: new SceneCSSGridLayout({ children: [] }),
          });
          // And re-init with the new query
          this.updateBody(true);
        }
      })
    );
  }

  private subscribeToPrimaryLabelsVariable() {
    const labelsVarPrimary = getLabelsVariable(this);
    this._subs.add(
      labelsVarPrimary.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.syncVariables();
        }
      })
    );
  }

  private subscribeToLabelFilterChanges() {
    const labelsVar = getLabelsVariableReplica(this);
    this._subs.add(
      labelsVar.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runVolumeQuery(true);
        }
      })
    );
  }

  private subscribeToVolume() {
    this._subs.add(
      this.state.$data.subscribeToState((newState, prevState) => {
        // update body if the data is done loading, and the dataframes have changed
        if (
          newState.data?.state === LoadingState.Done &&
          !areArraysEqual(prevState?.data?.series, newState?.data?.series)
        ) {
          this.updateBody(true);
        }
      })
    );
  }

  private subscribeToTimeRange() {
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        if (this.isTimeRangeTooEarlyForAggMetrics()) {
          this.onUnsupportedAggregatedMetricTimeRange();
        } else {
          this.onSupportedAggregatedMetricTimeRange();
        }
        this.runVolumeQuery();
      })
    );
  }

  /**
   * If the user copies a partial URL we want to prevent throwing runtime errors or running invalid queries, so we set the default tab which will trigger updates to the primary_label
   * @private
   */
  private fixRequiredUrlParams() {
    // If the selected tab is not in the URL, set the default
    const { key } = getSelectedTabFromUrl();
    if (!key) {
      this.selectDefaultLabelTab();
    }
  }

  private isTimeRangeTooEarlyForAggMetrics(): boolean {
    const timeRange = sceneGraph.getTimeRange(this);
    return timeRange.state.value.from.isBefore(dateTime(AGGREGATED_METRIC_START_DATE));
  }

  private onUnsupportedAggregatedMetricTimeRange() {
    const toolbar = this.getQueryOptionsToolbar();
    toolbar?.setState({
      options: {
        aggregatedMetrics: {
          ...toolbar?.state.options.aggregatedMetrics,
          disabled: true,
        },
      },
    });
  }

  private getQueryOptionsToolbar() {
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    return indexScene.state.controls.find((control) => control instanceof ToolbarScene) as ToolbarScene | undefined;
  }

  private onSupportedAggregatedMetricTimeRange() {
    const toolbar = this.getQueryOptionsToolbar();
    toolbar?.setState({
      options: {
        aggregatedMetrics: {
          ...toolbar?.state.options.aggregatedMetrics,
          disabled: false,
        },
      },
    });
  }

  private wrapWildcardSearch(input: string) {
    if (input !== '.+' && input.substring(0, 2) !== '.*') {
      return `.*${input}.*`;
    }

    return input;
  }

  public unwrapWildcardSearch(input: string) {
    if (input.substring(0, 2) === '.*' && input.slice(-2) === '.*') {
      return input.slice(2).slice(0, -2);
    }
    return input;
  }

  /**
   * Executes the Volume API call
   * @param resetQueryRunner - optional param which will replace the query runner state with a new instantiation
   * @private
   */
  private runVolumeQuery(resetQueryRunner = false) {
    if (resetQueryRunner) {
      this.setVolumeQueryRunner();
    }

    this.updateAggregatedMetricVariable();
    this.state.$data.runQueries();
  }

  private updateAggregatedMetricVariable() {
    const serviceLabelVar = getAggregatedMetricsVariable(this);
    const labelsVar = getLabelsVariable(this);
    if ((!this.isTimeRangeTooEarlyForAggMetrics() || !aggregatedMetricsEnabled) && this.isAggregatedMetricsActive()) {
      serviceLabelVar.changeValueTo(AGGREGATED_SERVICE_NAME);
      // Hide combobox if aggregated metrics
      labelsVar.setState({
        hide: VariableHide.hideVariable,
      });
    } else {
      serviceLabelVar.changeValueTo(SERVICE_NAME);
      // Show combobox if not aggregated metrics
      labelsVar.setState({
        hide: VariableHide.dontHide,
      });
      serviceLabelVar.changeValueTo(SERVICE_NAME);
    }
  }

  private updateTabs() {
    if (!this.state.tabs) {
      const tabs = new ServiceSelectionTabsScene({});
      this.setState({
        tabs,
      });
    }
  }

  private getGridItems(): SceneCSSGridItem[] {
    return this.state.body.state.children as SceneCSSGridItem[];
  }

  private getVizPanel(child: SceneCSSGridItem) {
    return child.state.body instanceof VizPanel ? child.state.body : undefined;
  }

  /**
   * Runs logs/volume panel queries if lazy loaded grid item is active
   * @param child
   * @private
   */
  private runPanelQuery(child: SceneCSSGridItem) {
    if (child.isActive) {
      const queryRunners = getQueryRunnerFromChildren(child);
      if (queryRunners.length === 1) {
        const queryRunner = queryRunners[0];
        const query = queryRunner.state.queries[0];

        // If the scene was cached, the time range will still be the same as what was executed in the query
        const requestTimeRange = queryRunner.state.data?.timeRange;
        const sceneTimeRange = sceneGraph.getTimeRange(this);
        const fromDiff = requestTimeRange
          ? sceneTimeRange.state.value.from.diff(requestTimeRange?.from, 's')
          : Infinity;
        const toDiff = requestTimeRange ? sceneTimeRange.state.value.to.diff(requestTimeRange?.to, 's') : Infinity;

        const interpolated = sceneGraph.interpolate(this, query.expr);
        // If we haven't already run this exact same query
        if (queryRunner.state.key !== interpolated || fromDiff > 0 || toDiff > 0) {
          queryRunner.setState({
            key: interpolated,
          });
          queryRunner.runQueries();
        }
      }
    }
  }

  private updateBody(runQueries = false) {
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    const selectedTab = this.getSelectedTab();
    this.updateTabs();
    // If no services are to be queried, clear the body
    if (!labelsToQuery || labelsToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const newChildren: SceneCSSGridItem[] = [];
      const existingChildren = this.getGridItems();
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      const aggregatedMetricsVariable = getAggregatedMetricsVariable(this);
      const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
      const datasourceVariable = getDataSourceVariable(this);

      for (const primaryLabelValue of labelsToQuery.slice(0, SERVICES_LIMIT)) {
        const existing = existingChildren.filter((child) => {
          const vizPanel = this.getVizPanel(child);
          return vizPanel?.state.title === primaryLabelValue;
        });

        if (existing.length === 2) {
          // If we already have grid items for this service, move them over to the new array of children, this will preserve their queryRunners, preventing duplicate queries from getting run
          newChildren.push(existing[0], existing[1]);

          if (existing[0].isActive && runQueries) {
            this.runPanelQuery(existing[0]);
          }

          if (existing[1].isActive && runQueries) {
            this.runPanelQuery(existing[1]);
          }
        } else {
          const newChildTs = this.buildServiceLayout(
            selectedTab,
            primaryLabelValue,
            timeRange,
            aggregatedMetricsVariable,
            primaryLabelVar,
            datasourceVariable
          );
          const newChildLogs = this.buildServiceLogsLayout(selectedTab, primaryLabelValue);
          // for each service, we create a layout with timeseries and logs panel
          newChildren.push(newChildTs, newChildLogs);
        }
      }

      this.state.body.setState({
        children: newChildren,
        isLazy: true,
        templateColumns: 'repeat(auto-fit, minmax(500px, 1fr) minmax(300px, 70vw))',
        autoRows: '200px',
        md: {
          templateColumns: '1fr',
          rowGap: 1,
          columnGap: 1,
        },
      });
    }
  }

  /**
   * Redraws service logs after toggling level visibility.
   */
  private updateServiceLogs(labelName: string, labelValue: string) {
    if (!this.state.body) {
      this.updateBody();
      return;
    }
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    const serviceIndex = labelsToQuery?.indexOf(labelValue);
    if (serviceIndex === undefined || serviceIndex < 0) {
      return;
    }
    let newChildren = [...this.getGridItems()];
    newChildren.splice(serviceIndex * 2 + 1, 1, this.buildServiceLogsLayout(labelName, labelValue));
    this.state.body.setState({ children: newChildren });
  }

  private getLogExpression(labelName: string, labelValue: string, levelFilter: string) {
    return `{${labelName}=\`${labelValue}\` , ${VAR_LABELS_REPLICA_EXPR} }${levelFilter}`;
  }

  private getMetricExpression(
    labelValue: string,
    serviceLabelVar: CustomConstantVariable,
    primaryLabelVar: AdHocFiltersVariable
  ) {
    const filter = primaryLabelVar.state.filters[0];
    if (serviceLabelVar.state.value === AGGREGATED_SERVICE_NAME) {
      if (filter.key === SERVICE_NAME) {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=\`${labelValue}\` } | logfmt | unwrap count [$__auto]))`;
      } else {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=~\`.+\` } | logfmt | ${filter.key}=\`${labelValue}\` | unwrap count [$__auto]))`;
      }
    }
    return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({ ${filter.key}=\`${labelValue}\`, ${VAR_LABELS_REPLICA_EXPR} } [$__auto]))`;
  }

  private extendTimeSeriesLegendBus = (
    labelName: string,
    labelValue: string,
    context: PanelContext,
    panel: VizPanel
  ) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(level, mode);

      const allLevels = getLabelsFromSeries(panel.state.$data?.state.data?.series ?? []);
      const levels = toggleLevelVisibility(level, this.state.serviceLevel.get(labelValue), mode, allLevels);
      this.state.serviceLevel.set(labelValue, levels);

      this.updateServiceLogs(labelName, labelValue);
    };
  };

  private getLabels(series?: DataFrame[]) {
    const labelsByVolume: string[] = series?.[0]?.fields[0].values ?? [];
    const dsString = getDataSourceVariable(this).getValue()?.toString();
    const searchString = getServiceSelectionSearchVariable(this).getValue();
    const selectedTab = this.getSelectedTab();
    const labelsToQuery = createListOfLabelsToQuery(labelsByVolume, dsString, String(searchString), selectedTab);
    return { labelsByVolume, labelsToQuery: labelsToQuery };
  }
}

// Create a list of services to query:
// 1. Filters provided services by searchString
// 2. Gets favoriteServicesToQuery from localStorage and filters them by searchString
// 3. Orders them correctly
function createListOfLabelsToQuery(services: string[], ds: string, searchString: string, labelName: string) {
  if (!services?.length) {
    return [];
  }

  if (searchString === '.+') {
    searchString = '';
  }

  const favoriteServicesToQuery = getFavoriteLabelValuesFromStorage(ds, labelName).filter(
    (service) => service.toLowerCase().includes(searchString.toLowerCase()) && services.includes(service)
  );

  // Deduplicate
  return Array.from(new Set([...favoriteServicesToQuery, ...services]));
}

function getSelectedTabFromUrl() {
  const location = locationService.getLocation();
  const search = new URLSearchParams(location.search);
  const primaryLabelRaw = search.get(primaryLabelUrlKey);
  const primaryLabelSplit = primaryLabelRaw?.split('|');
  const key = primaryLabelSplit?.[0];
  return { key, search, location };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      position: 'relative',
    }),
    headingWrapper: css({
      marginTop: theme.spacing(1),
    }),
    loadingText: css({
      margin: 0,
    }),
    header: css({
      position: 'absolute',
      right: 0,
      top: '4px',
      zIndex: 2,
    }),
    bodyWrapper: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    icon: css({
      color: theme.colors.text.disabled,
      marginLeft: theme.spacing.x1,
    }),
    searchFieldPlaceholderText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.disabled,
      alignItems: 'center',
      display: 'flex',
    }),
    searchWrapper: css({
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
    }),
    searchField: css({
      marginTop: theme.spacing(1),
      position: 'relative',
    }),
  };
}
