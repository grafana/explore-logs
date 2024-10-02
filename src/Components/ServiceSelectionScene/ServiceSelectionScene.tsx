import { css } from '@emotion/css';
import { debounce, rest } from 'lodash';
import React, { useRef } from 'react';
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
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
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
  Popover,
  PopoverController,
  Select,
  SeriesVisibilityChangeMode,
  Stack,
  StackingMode,
  Tab,
  TabsBar,
  useStyles2,
} from '@grafana/ui';
import { getFavoriteServicesFromStorage } from 'services/store';
import {
  LEVEL_VARIABLE_VALUE,
  SERVICE_LABEL_EXPR,
  SERVICE_LABEL_VAR,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  VAR_PRIMARY_LABEL,
  VAR_PRIMARY_LABEL_EXPR,
  VAR_PRIMARY_LABEL_SEARCH,
  VAR_PRIMARY_LABEL_SEARCH_EXPR,
} from 'services/variables';
import { selectService, SelectServiceButton } from './SelectServiceButton';
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
  getDataSourceVariable,
  getLabelsVariable,
  getServiceLabelVariable,
  getServiceSelectionPrimaryLabel,
  getServiceSelectionSearchVariable,
} from '../../services/variableGetters';
import { config } from '@grafana/runtime';
import { VariableHide } from '@grafana/schema';
import { ToolbarScene } from '../IndexScene/ToolbarScene';
import { IndexScene } from '../IndexScene/IndexScene';

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
  $labelsData: SceneQueryRunner;
  showPopover: boolean;
  selectedTab: string;
  tabOptions: Array<{
    label: string;
    value: string;
  }>;
}

function renderPrimaryLabelFilters(filters: AdHocVariableFilter[]): string {
  console.log('renderPrimaryLabelFilters', filters);
  if (filters.length) {
    const filter = filters[0];
    const result = `, ${filter.key}${filter.operator}\`${filter.value}\``;
    console.log('renderPrimaryLabelFilters result', result);
    return result;
  }

  return '';
}

export class ServiceSelectionScene extends SceneObjectBase<ServiceSelectionSceneState> {
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
            value: '',
            skipUrlSync: true,
          }),
          // variable to store the service label to use
          new CustomConstantVariable({
            name: SERVICE_LABEL_VAR,
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
            label: '',
            hide: VariableHide.hideVariable,
            expressionBuilder: renderPrimaryLabelFilters,
          }),
        ],
      }),
      $data: getSceneQueryRunner({
        queries: [
          buildResourceQuery(
            `{${SERVICE_LABEL_EXPR}=~\`.*${VAR_PRIMARY_LABEL_SEARCH_EXPR}.*\` ${VAR_PRIMARY_LABEL_EXPR}}`,
            'volume'
          ),
        ],
        runQueriesMode: 'manual',
      }),
      $labelsData: getSceneQueryRunner({
        queries: [buildResourceQuery('', 'labels')],
        runQueriesMode: 'manual',
      }),
      serviceLevel: new Map<string, string[]>(),
      showPopover: false,
      selectedTab: SERVICE_NAME,
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

  private populatePrimaryLabelsVariableOptions(labels: string[]) {
    this.setState({
      tabOptions: labels
        .filter((l) => l !== '__stream_shard__' && l !== '__aggregated_metric__')
        .map((l) => {
          return {
            label: l === SERVICE_NAME ? SERVICE_UI_LABEL : l,
            value: l,
          };
        }),
    });
  }

  private onActivate() {
    // Clear all adhoc filters when the scene is activated, if there are any
    const variable = getLabelsVariable(this);
    if (variable.state.filters.length > 0) {
      variable.setState({
        filters: [],
      });
    }

    // Get labels
    this.state.$labelsData.runQueries();

    this._subs.add(
      this.state.$labelsData.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          const labels: string[] = newState.data?.series?.[0].fields[0].values;
          this.populatePrimaryLabelsVariableOptions(labels);
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
      getDataSourceVariable(this).subscribeToState(() => {
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
      getServiceLabelVariable(this).subscribeToState((newState, prevState) => {
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

  public isAggregatedMetricsActive() {
    const toolbar = this.getQueryOptionsToolbar();
    return !toolbar?.state.options.aggregatedMetrics.disabled && toolbar?.state.options.aggregatedMetrics.active;
  }

  private runVolumeQuery() {
    const serviceLabelVar = getServiceLabelVariable(this);
    if ((!this.isTimeRangeTooEarlyForAggMetrics() || !aggregatedMetricsEnabled) && this.isAggregatedMetricsActive()) {
      serviceLabelVar.changeValueTo(AGGREGATED_SERVICE_NAME);
    } else {
      serviceLabelVar.changeValueTo(SERVICE_NAME);
    }
    this.state.$data.runQueries();
  }

  private updateBody() {
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    // If no services are to be queried, clear the body
    if (!labelsToQuery || labelsToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const newChildren: SceneCSSGridItem[] = [];
      const existingChildren: SceneCSSGridItem[] = this.state.body.state.children as SceneCSSGridItem[];
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      const serviceLabelVar = getServiceLabelVariable(this);

      for (const service of labelsToQuery.slice(0, SERVICES_LIMIT)) {
        const existing = existingChildren.filter((child) => {
          const vizPanel = child.state.body as VizPanel | undefined;
          return vizPanel?.state.title === service;
        });

        if (existing.length === 2) {
          // If we already have grid items for this service, move them over to the new array of children, this will preserve their queryRunners, preventing duplicate queries from getting run
          newChildren.push(existing[0], existing[1]);
        } else {
          // for each service, we create a layout with timeseries and logs panel
          newChildren.push(
            this.buildServiceLayout(service, timeRange, serviceLabelVar),
            this.buildServiceLogsLayout(service)
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
  private updateServiceLogs(service: string) {
    if (!this.state.body) {
      this.updateBody();
      return;
    }
    const { labelsToQuery } = this.getLabels(this.state.$data.state.data?.series);
    const serviceIndex = labelsToQuery?.indexOf(service);
    if (serviceIndex === undefined || serviceIndex < 0) {
      return;
    }
    if (this.state.body) {
      let newChildren = [...this.state.body.state.children];
      newChildren.splice(serviceIndex * 2 + 1, 1, this.buildServiceLogsLayout(service));
      this.state.body.setState({ children: newChildren });
    }
  }

  private getLogExpression(service: string, levelFilter: string) {
    return `{${SERVICE_LABEL_EXPR}=\`${service}\`}${levelFilter}`;
  }

  private getMetricExpression(service: string, serviceLabelVar: CustomConstantVariable) {
    if (serviceLabelVar.state.value === AGGREGATED_SERVICE_NAME) {
      return `sum by (${LEVEL_VARIABLE_VALUE}) (sum_over_time({${AGGREGATED_SERVICE_NAME}=\`${service}\`} | logfmt | unwrap count [$__auto]))`;
    }
    return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({${SERVICE_LABEL_EXPR}=\`${service}\`} [$__auto]))`;
  }

  private extendTimeSeriesLegendBus = (service: string, context: PanelContext, panel: VizPanel) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(level, mode);

      const allLevels = getLabelsFromSeries(panel.state.$data?.state.data?.series ?? []);
      const levels = toggleLevelVisibility(level, this.state.serviceLevel.get(service), mode, allLevels);
      this.state.serviceLevel.set(service, levels);

      this.updateServiceLogs(service);
    };
  };

  // Creates a layout with timeseries panel
  buildServiceLayout(service: string, timeRange: TimeRange, serviceLabelVar: CustomConstantVariable) {
    let splitDuration;
    if (timeRange.to.diff(timeRange.from, 'hours') >= 4 && timeRange.to.diff(timeRange.from, 'hours') <= 26) {
      splitDuration = '2h';
    }
    const panel = PanelBuilders.timeseries()
      // If service was previously selected, we show it in the title
      .setTitle(service)
      .setData(
        getQueryRunner([
          buildDataQuery(this.getMetricExpression(service, serviceLabelVar), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
            splitDuration,
            refId: `ts-${service}`,
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
      .setHeaderActions(new SelectServiceButton({ service }))
      .build();

    panel.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(service, context, panel),
    });

    return new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ key: 'serviceCrosshairSync', sync: DashboardCursorSync.Crosshair })],
      body: panel,
    });
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
  buildServiceLogsLayout = (service: string) => {
    const levelFilter = this.getLevelFilterForService(service);
    return new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ sync: DashboardCursorSync.Off })],
      body: PanelBuilders.logs()
        // Hover header set to true removes unused header padding, displaying more logs
        .setHoverHeader(true)
        .setData(
          getQueryRunner([
            buildDataQuery(this.getLogExpression(service, levelFilter), {
              maxLines: 100,
              refId: `logs-${service}`,
            }),
          ])
        )
        .setTitle(service)
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .build(),
    });
  };

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  public onSearchServicesChange = debounce((serviceString?: string) => {
    const variable = getServiceSelectionSearchVariable(this);
    variable.changeValueTo(serviceString ?? '');
    this.state.$data.runQueries();

    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.search_services_changed,
      {
        searchQuery: serviceString,
      }
    );
  }, 500);

  public toggleShowPopover = () => {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  };

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionScene>) => {
    const styles = useStyles2(getStyles);
    const popoverStyles = useStyles2(getPopoverStyles);
    const { body, $data, showPopover } = model.useState();
    const { data } = $data.useState();

    const serviceStringVariable = getServiceSelectionSearchVariable(model);
    const { value } = serviceStringVariable.useState();

    const { labelsByVolume, labelsToQuery } = model.getLabels(data?.series);
    const isLogVolumeLoading =
      data?.state === LoadingState.Loading || data?.state === LoadingState.Streaming || data === undefined;
    const volumeApiError = $data.state.data?.state === LoadingState.Error;

    const onSearchChange = (serviceName: string) => {
      model.onSearchServicesChange(serviceName);
    };
    const totalServices = labelsToQuery?.length ?? 0;
    // To get the count of services that are currently displayed, divide the number of panels by 2, as there are 2 panels per service (logs and time series)
    const renderedServices = body.state.children.length / 2;

    const primaryLabel = getServiceSelectionPrimaryLabel(model);

    const tabLabels: Array<{ label: string; value: string; counter?: number; active: boolean }> = [
      ...model.state.tabOptions.map((opt) => {
        return {
          value: opt.value.toString(),
          label: opt.label,
          active: model.state.selectedTab === opt.value,
          counter: undefined,
        };
      }),
    ].sort((a, b) => {
      return a === b ? 0 : a ? -1 : 1;
    });

    const popoverRef = useRef<HTMLElement>(null);

    const popoverContent = (
      <Stack direction="column" gap={0} role="tooltip">
        <div className={popoverStyles.card.body}>
          <Select
            placeholder={'Search labels'}
            options={model.state.tabOptions}
            isSearchable={true}
            onChange={(opt) => {
              // Hide the popover
              model.toggleShowPopover();

              // Add value to variable
              if (opt.value) {
                // Add tab
                model.setState({
                  selectedTab: opt.value,
                });
                primaryLabel.setState({
                  filters: [
                    {
                      value: '.+',
                      operator: '=~',
                      key: opt.value,
                    },
                  ],
                });

                // primaryLabel.changeValueTo(opt.value.toString())

                // Update volume query
                // const serviceLabelVar = getServiceLabelVariable(model);
                // serviceLabelVar.changeValueTo(opt.value.toString())
                $data.runQueries();
              }
            }}
          />
        </div>
      </Stack>
    );

    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          <div>
            {/** When services fetched, show how many services are we showing */}
            {isLogVolumeLoading && <LoadingPlaceholder text={'Loading services'} className={styles.loadingText} />}
            {!isLogVolumeLoading && (
              <>
                Showing {renderedServices} of {totalServices} service{totalServices !== 1 ? 's' : ''}
              </>
            )}
          </div>
          <Field className={styles.searchField}>
            <ServiceFieldSelector
              initialFilter={{
                label: serviceStringVariable.getValue().toString(),
                value: serviceStringVariable.getValue().toString(),
                icon: 'filter',
              }}
              isLoading={isLogVolumeLoading}
              value={String(value)}
              onChange={(serviceName) => onSearchChange(serviceName ?? '')}
              selectOption={(value: string) => {
                selectService(value, model);
              }}
              label="Service"
              options={
                labelsToQuery?.map((serviceName) => ({
                  value: serviceName,
                  label: serviceName,
                })) ?? []
              }
            />
          </Field>
          <TabsBar>
            {tabLabels.map((tabLabel) => (
              <Tab
                key={tabLabel.value}
                onChangeTab={() => {
                  model.setState({
                    selectedTab: tabLabel.value,
                  });
                  primaryLabel.setState({
                    filters: [
                      {
                        value: '.+',
                        key: tabLabel.value,
                        operator: '=~',
                      },
                    ],
                  });
                }}
                label={tabLabel.label}
                active={tabLabel.active}
                counter={tabLabel.counter}
              />
            ))}
            {/* Add more tabs tab */}
            <Tab onChangeTab={model.toggleShowPopover} label={''} ref={popoverRef} icon={'plus-circle'} />

            <PopoverController content={popoverContent}>
              {(showPopper, hidePopper, popperProps) => {
                const blurFocusProps = {
                  onBlur: hidePopper,
                  onFocus: showPopper,
                };

                return (
                  <>
                    {popoverRef.current && (
                      <>
                        {/* @ts-expect-error @todo upgrade typescript */}
                        <Popover
                          {...popperProps}
                          {...rest}
                          show={showPopover}
                          wrapperClassName={popoverStyles.popover}
                          referenceElement={popoverRef.current}
                          renderArrow={true}
                          {...blurFocusProps}
                        />
                      </>
                    )}
                  </>
                );
              }}
            </PopoverController>
          </TabsBar>
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

  private getLabels(series?: DataFrame[]) {
    const labelsByVolume: string[] = series?.[0]?.fields[0].values ?? [];
    const dsString = getDataSourceVariable(this).getValue()?.toString();
    const searchString = getServiceSelectionSearchVariable(this).getValue();
    const labelsToQuery = createListOfLabelsToQuery(labelsByVolume, dsString, String(searchString));
    return { labelsByVolume, labelsToQuery: labelsToQuery };
  }
}

// Create a list of services to query:
// 1. Filters provided services by searchString
// 2. Gets favoriteServicesToQuery from localStorage and filters them by searchString
// 3. Orders them correctly
function createListOfLabelsToQuery(services: string[], ds: string, searchString: string) {
  if (!services?.length) {
    return [];
  }

  const servicesToQuery = services.filter((service) => service.toLowerCase().includes(searchString.toLowerCase()));
  const favoriteServicesToQuery = getFavoriteServicesFromStorage(ds).filter(
    (service) => service.toLowerCase().includes(searchString.toLowerCase()) && servicesToQuery.includes(service)
  );

  // Deduplicate
  return Array.from(new Set([...favoriteServicesToQuery, ...servicesToQuery]));
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
    searchField: css({
      marginTop: theme.spacing(1),
    }),
  };
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  card: {
    body: css({
      padding: theme.spacing(1),
    }),
    header: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderBottom: `solid 1px ${theme.colors.border.medium}`,
    }),
    footer: css({
      padding: theme.spacing(0.5, 1),
      background: theme.colors.background.secondary,
      borderTop: `solid 1px ${theme.colors.border.medium}`,
    }),
  },
});
