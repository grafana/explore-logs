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
  LegendDisplayMode,
  LoadingPlaceholder,
  PanelContext,
  SeriesVisibilityChangeMode,
  StackingMode,
  useStyles2,
} from '@grafana/ui';
import { addTabToLocalStorage, getFavoriteLabelValuesFromStorage } from 'services/store';
import {
  LEVEL_VARIABLE_VALUE,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_AGGREGATED_METRICS,
  VAR_PRIMARY_LABEL,
  VAR_PRIMARY_LABEL_EXPR,
  VAR_PRIMARY_LABEL_SEARCH,
} from 'services/variables';
import { selectLabel, SelectServiceButton } from './SelectServiceButton';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getQueryRunner, getSceneQueryRunner, setLevelColorOverrides } from 'services/panel';
import { ConfigureVolumeError } from './ConfigureVolumeError';
import { NoVolumeError } from './NoVolumeError';
import { getLabelsFromSeries, toggleLevelVisibility } from 'services/levels';
import { ServiceFieldSelector } from '../ServiceScene/Breakdowns/FieldSelector';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import { areArraysEqual } from '../../services/comparison';
import {
  clearServiceSelectionSearchVariable,
  getAggregatedMetricsVariable,
  getDataSourceVariable,
  getLabelsVariable,
  getServiceSelectionPrimaryLabel,
  getServiceSelectionSearchVariable,
  setServiceSelectionPrimaryLabelKey,
} from '../../services/variableGetters';
import { config, locationService } from '@grafana/runtime';
import { VariableHide } from '@grafana/schema';
import { ToolbarScene } from '../IndexScene/ToolbarScene';
import { IndexScene } from '../IndexScene/IndexScene';
import { capitalizeFirstLetter } from '../../services/text';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';
import { FavoriteServiceHeaderActionScene } from './FavoriteServiceHeaderActionScene';
import { pushUrlHandler } from '../../services/navigate';

// @ts-expect-error
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
        ],
      }),
      $data: getSceneQueryRunner({
        queries: [buildResourceQuery(`{${VAR_PRIMARY_LABEL_EXPR}}`, 'volume')],
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
    const { label } = serviceStringVariable.useState();

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
          <div>
            {/** When services fetched, show how many services are we showing */}
            {isLogVolumeLoading && <LoadingPlaceholder text={'Loading services'} className={styles.loadingText} />}
          </div>

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
                  Showing {renderedServices} of {totalServices}
                </span>
              )}
            </div>
          </Field>
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isLogVolumeLoading && volumeApiError && <ConfigureVolumeError />}
          {!isLogVolumeLoading && !volumeApiError && !labelsByVolume?.length && <NoVolumeError />}
          {labelsToQuery && labelsToQuery.length > 0 && (
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

  getSelectedTabLabel() {
    return getServiceSelectionPrimaryLabel(this).state.filters[0].key;
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
        getQueryRunner([
          buildDataQuery(this.getMetricExpression(primaryLabelValue, serviceLabelVar, primaryLabelVar), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
            splitDuration,
            refId: `ts-${primaryLabelValue}`,
          }),
        ])
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
        new SelectServiceButton({ labelValue: primaryLabelValue, labelName: primaryLabelName }),
      ])
      .build();

    panel.setState({
      extendPanelContext: (_, context) =>
        this.extendTimeSeriesLegendBus(primaryLabelName, primaryLabelValue, context, panel),
    });

    return new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ key: 'serviceCrosshairSync', sync: DashboardCursorSync.Crosshair })],
      body: panel,
    });
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
    return new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
      body: PanelBuilders.logs()
        // Hover header set to true removes unused header padding, displaying more logs
        .setHoverHeader(true)
        .setData(
          getQueryRunner([
            buildDataQuery(this.getLogExpression(labelName, labelValue, levelFilter), {
              maxLines: 100,
              refId: `logs-${labelValue}`,
            }),
          ])
        )
        .setTitle(labelValue)
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .build(),
    });
  };

  formatPrimaryLabelForUI() {
    const selectedTab = this.getSelectedTab();
    return capitalizeFirstLetter(selectedTab === SERVICE_NAME ? SERVICE_UI_LABEL : selectedTab);
  }

  private onActivate() {
    // Clear existing volume data on activate or we'll show stale cached data, potentially from a different datasource
    this.setState({
      $data: getSceneQueryRunner({
        queries: [buildResourceQuery(`{${VAR_PRIMARY_LABEL_EXPR}}`, 'volume')],
        runQueriesMode: 'manual',
      }),
    });

    // Clear all adhoc filters when the scene is activated, if there are any
    const variable = getLabelsVariable(this);
    if (variable.state.filters.length > 0) {
      variable.setState({
        filters: [],
      });
    }

    const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
    this._subs.add(
      primaryLabelVar.subscribeToState((newState, prevState) => {
        if (newState.filterExpression !== prevState.filterExpression) {
          const newKey = newState.filters[0].key;
          this.addLabelChangeToBrowserHistory(newKey);
          this.runVolumeQuery();
        }
      })
    );

    this._subs.add(
      this.state.$data.subscribeToState((newState, prevState) => {
        // update body if the data is done loading, and the dataframes have changed
        if (
          newState.data?.state === LoadingState.Done &&
          !areArraysEqual(prevState?.data?.series, newState?.data?.series)
        ) {
          this.updateBody();
        }
      })
    );

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

    // Update labels on time range change
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

    // Update labels on datasource change
    this._subs.add(
      getDataSourceVariable(this).subscribeToState((newState) => {
        this.addDatasourceChangeToBrowserHistory(newState.value.toString());
        this.runVolumeQuery();
      })
    );

    this._subs.add(
      this.getQueryOptionsToolbar()?.subscribeToState((newState, prevState) => {
        if (newState.options.aggregatedMetrics.userOverride !== prevState.options.aggregatedMetrics.userOverride) {
          this.runVolumeQuery();
        }
      })
    );

    // agg metrics need parser and unwrap, have to tear down and rebuild panels when the variable changes
    this._subs.add(
      getAggregatedMetricsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          // Clear the body panels
          this.setState({
            body: new SceneCSSGridLayout({ children: [] }),
          });
          // And re-init with the new query
          this.updateBody();
        }
      })
    );
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

  private runVolumeQuery() {
    this.updateAggregatedMetricVariable();
    this.state.$data.runQueries();
  }

  private updateAggregatedMetricVariable() {
    const serviceLabelVar = getAggregatedMetricsVariable(this);
    if ((!this.isTimeRangeTooEarlyForAggMetrics() || !aggregatedMetricsEnabled) && this.isAggregatedMetricsActive()) {
      serviceLabelVar.changeValueTo(AGGREGATED_SERVICE_NAME);
    } else {
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

  private updateBody() {
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    this.updateTabs();
    // If no services are to be queried, clear the body
    if (!labelsToQuery || labelsToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const newChildren: SceneCSSGridItem[] = [];
      const existingChildren: SceneCSSGridItem[] = this.state.body.state.children as SceneCSSGridItem[];
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      const aggregatedMetricsVariable = getAggregatedMetricsVariable(this);
      const primaryLabelVar = getServiceSelectionPrimaryLabel(this);
      const selectedTab = this.getSelectedTab();
      const datasourceVariable = getDataSourceVariable(this);

      for (const primaryLabelValue of labelsToQuery.slice(0, SERVICES_LIMIT)) {
        const existing = existingChildren.filter((child) => {
          const vizPanel = child.state.body as VizPanel | undefined;
          return vizPanel?.state.title === primaryLabelValue;
        });

        if (existing.length === 2) {
          // If we already have grid items for this service, move them over to the new array of children, this will preserve their queryRunners, preventing duplicate queries from getting run
          newChildren.push(existing[0], existing[1]);
        } else {
          // for each service, we create a layout with timeseries and logs panel
          newChildren.push(
            this.buildServiceLayout(
              selectedTab,
              primaryLabelValue,
              timeRange,
              aggregatedMetricsVariable,
              primaryLabelVar,
              datasourceVariable
            ),
            this.buildServiceLogsLayout(selectedTab, primaryLabelValue)
          );
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
    if (this.state.body) {
      let newChildren = [...this.state.body.state.children];
      newChildren.splice(serviceIndex * 2 + 1, 1, this.buildServiceLogsLayout(labelName, labelValue));
      this.state.body.setState({ children: newChildren });
    }
  }

  private getLogExpression(labelName: string, labelValue: string, levelFilter: string) {
    return `{${labelName}=\`${labelValue}\`}${levelFilter}`;
  }

  private getMetricExpression(
    labelValue: string,
    serviceLabelVar: CustomConstantVariable,
    primaryLabelVar: AdHocFiltersVariable
  ) {
    const filter = primaryLabelVar.state.filters[0];
    if (serviceLabelVar.state.value === AGGREGATED_SERVICE_NAME) {
      if (filter.key === SERVICE_NAME) {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=\`${labelValue}\`} | logfmt | unwrap count [$__auto]))`;
      } else {
        return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=~\`.+\` } | logfmt | ${filter.key}=\`${labelValue}\` | unwrap count [$__auto]))`;
      }
    }
    return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({ ${filter.key}=\`${labelValue}\` } [$__auto]))`;
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
    searchFieldPlaceholderText: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.disabled,
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
