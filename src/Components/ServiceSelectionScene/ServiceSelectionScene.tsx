import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';
import { DashboardCursorSync, GrafanaTheme2, LoadingState, PanelData, TimeRange } from '@grafana/data';
import {
  behaviors,
  PanelBuilders,
  QueryVariable,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataProvider,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
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
import { getFavoriteServicesFromStorage } from 'services/store';
import {
  getDataSourceVariable,
  getLabelsVariable,
  getServiceSelectionStringVariable,
  LEVEL_VARIABLE_VALUE,
  VAR_DATASOURCE,
  VAR_SERVICE,
} from 'services/variables';
import { selectService, SelectServiceButton } from './SelectServiceButton';
import { buildLokiQuery, buildResourceQuery } from 'services/query';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { ConfigureVolumeError } from './ConfigureVolumeError';
import { NoVolumeError } from './NoVolumeError';
import { getLabelsFromSeries, toggleLevelFromFilter } from 'services/levels';
import { ServiceFieldSelector } from '../ServiceScene/Breakdowns/FieldSelector';
import { VariableHide } from '@grafana/schema';
import { WRAPPED_LOKI_DS_UID } from '../../services/datasource';

export const SERVICE_NAME = 'service_name';

interface ServiceSelectionSceneState extends SceneObjectState {
  // The body of the component
  body: SceneCSSGridLayout;

  volumeApiError?: boolean;
  // Show logs of a certain level for a given service
  serviceLevel: Map<string, string[]>;
  // Logs volume API response as dataframe with SceneQueryRunner
  $data: SceneDataProvider;
}

function getMetricExpression(service: string) {
  return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({${SERVICE_NAME}=\`${service}\`} | drop __error__ [$__auto]))`;
}

function getLogExpression(service: string, levelFilter: string) {
  return `{${SERVICE_NAME}=\`${service}\`}${levelFilter}`;
}

export class ServiceSelectionScene extends SceneObjectBase<ServiceSelectionSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    // We want to subscribe to changes in datasource variables and update the top services when the datasource changes
    variableNames: [VAR_DATASOURCE, VAR_SERVICE],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      console.log('onReferencedVariableValueChanged', variable);
      const { name } = variable.state;
      if (name === VAR_DATASOURCE) {
        console.log('data source changed');
        // this.state.$data.
      }
    },
  });

  constructor(state: Partial<ServiceSelectionSceneState>) {
    super({
      body: new SceneCSSGridLayout({ children: [] }),
      // isServicesByVolumeLoading: false,
      // servicesByVolume: undefined,
      // searchServicesString: '',
      // servicesToQuery: undefined,
      $variables: new SceneVariableSet({
        variables: [
          new QueryVariable({
            name: VAR_SERVICE,
            label: 'Service',
            hide: VariableHide.hideVariable,
            value: '.+',
            // @todo if interpolation can be fixed, we should update the query whenever the datasource updates
            datasource: { uid: WRAPPED_LOKI_DS_UID },

            // @todo why does setting a query prevent the query from running at all?
            query: {
              query: `*`,
              refId: 'A',
            },
          }),
        ],
      }),

      //@todo how to interpolate VAR_SERVICE??
      $data: getQueryRunner(
        buildResourceQuery(
          `{${SERVICE_NAME}=~\`.+\`}`,
          // `{${SERVICE_NAME}=~\`.+\`, ${VAR_SERVICE_EXPR}}`,

          // Works for all values, but won't search for matches because the interpolation isn't working
          // `{${SERVICE_NAME}=~\`.+\`}`,

          'volume'
        )
      ),
      serviceLevel: new Map<string, string[]>(),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    // Clear all adhoc filters when the scene is activated, if there are any
    const variable = getLabelsVariable(this);
    if (variable.state.filters.length > 0) {
      variable.setState({
        filters: [],
      });
    }

    const serviceVariable = getServiceSelectionStringVariable(this);

    // Reset search after routing back
    if (serviceVariable.state.value) {
      serviceVariable.setState({
        value: '.+',
      });
    }

    this.state.$data.subscribeToState((newState) => {
      console.log('data update, updating body', newState);
      if (newState.data?.state === LoadingState.Done) {
        this.updateBody();
        if (this.state.volumeApiError) {
          this.setState({
            volumeApiError: false,
          });
        }
      }
      if (newState.data?.state === LoadingState.Error) {
        this.setState({
          volumeApiError: true,
        });
      }
    });
  }

  private updateBody() {
    const { servicesToQuery } = this.getServices(this.state.$data.state.data);
    // If no services are to be queried, clear the body
    if (!servicesToQuery || servicesToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const children: SceneCSSGridItem[] = [];
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      for (const service of servicesToQuery) {
        // for each service, we create a layout with timeseries and logs panel
        children.push(this.buildServiceLayout(service, timeRange), this.buildServiceLogsLayout(service));
      }
      this.state.body.setState({
        children,
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
    const { servicesToQuery } = this.getServices(this.state.$data.state.data);
    const serviceIndex = servicesToQuery?.indexOf(service);
    if (serviceIndex === undefined || serviceIndex < 0) {
      return;
    }
    this.state.body.forEachChild((scene) => {
      if (scene instanceof SceneCSSGridLayout) {
        let newChildren = [...scene.state.children];
        newChildren.splice(serviceIndex * 2 + 1, 1, this.buildServiceLogsLayout(service));
        scene.setState({ children: newChildren });
      }
    });
  }

  private extendTimeSeriesLegendBus = (service: string, context: PanelContext, panel: VizPanel) => {
    const originalOnToggleSeriesVisibility = context.onToggleSeriesVisibility;

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      originalOnToggleSeriesVisibility?.(level, mode);

      const allLevels = getLabelsFromSeries(panel.state.$data?.state.data?.series ?? []);
      console.log('allLevels', allLevels);
      console.log('panel.state.$data?.state.data?.series', panel.state.$data?.state.data?.series);
      console.log('panel', panel);

      const levels = toggleLevelFromFilter(level, this.state.serviceLevel.get(service), mode, allLevels);
      this.state.serviceLevel.set(service, levels);

      this.updateServiceLogs(service);
    };
  };

  // Creates a layout with timeseries panel
  buildServiceLayout(service: string, timeRange: TimeRange) {
    let splitDuration;
    if (timeRange.to.diff(timeRange.from, 'hours') >= 4 && timeRange.to.diff(timeRange.from, 'hours') <= 26) {
      splitDuration = '2h';
    }
    const panel = PanelBuilders.timeseries()
      // If service was previously selected, we show it in the title
      .setTitle(service)
      .setData(
        getQueryRunner(
          buildLokiQuery(getMetricExpression(service), {
            legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`,
            splitDuration,
            refId: `ts-${service}`,
          })
        )
      )
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setUnit('short')
      .setOverrides(setLeverColorOverrides)
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
      return `detected_level=\`${level}\``;
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
          getQueryRunner(
            buildLokiQuery(getLogExpression(service, levelFilter), {
              maxLines: 100,
              refId: `logs-${service}`,
            })
          )
        )
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .build(),
    });
  };

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  public onSearchServicesChange = debounce((serviceString?: string) => {
    const variable = getServiceSelectionStringVariable(this);
    console.log('setting new state', serviceString);
    variable.setState({
      value: String(serviceString),
    });
    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.search_services_changed,
      {
        searchQuery: serviceString,
      }
    );
  }, 500);

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionScene>) => {
    const styles = useStyles2(getStyles);
    const { body, volumeApiError, $data } = model.useState();

    const serviceStringVariable = getServiceSelectionStringVariable(model);
    const { value } = serviceStringVariable.useState();
    const { data } = $data.useState();
    const { servicesByVolume, servicesToQuery } = model.getServices(data);
    const isServicesByVolumeLoading = data?.state === LoadingState.Loading || data?.state === undefined;

    const onSearchChange = (serviceName: string) => {
      model.onSearchServicesChange(serviceName);
    };
    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          <div>
            {/** When services fetched, show how many services are we showing */}
            {isServicesByVolumeLoading && (
              <LoadingPlaceholder text={'Loading services'} className={styles.loadingText} />
            )}
            {!isServicesByVolumeLoading && <>Showing {servicesToQuery?.length ?? 0} services</>}
          </div>
          <Field className={styles.searchField}>
            <ServiceFieldSelector
              isLoading={isServicesByVolumeLoading}
              value={String(value)}
              onChange={(serviceName) => onSearchChange(serviceName ?? '')}
              selectOption={(value: string) => {
                selectService(value, model);
              }}
              label="Service"
              options={
                servicesToQuery?.map((serviceName) => ({
                  value: serviceName,
                  label: serviceName,
                })) ?? []
              }
            />
          </Field>
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isServicesByVolumeLoading && volumeApiError && <ConfigureVolumeError />}
          {!isServicesByVolumeLoading && !volumeApiError && !servicesByVolume?.length && <NoVolumeError />}
          {!isServicesByVolumeLoading && servicesToQuery && servicesToQuery.length > 0 && (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </div>
    );
  };

  private getServices(data?: PanelData) {
    const servicesByVolume: string[] =
      data?.series?.[0]?.fields?.find((field) => field.name === 'service_name')?.values ?? [];
    const dsString = getDataSourceVariable(this).getValue()?.toString();
    const searchString = getServiceSelectionStringVariable(this).getValue();
    const servicesToQuery = createListOfServicesToQuery(servicesByVolume, dsString, String(searchString));
    return { servicesByVolume, servicesToQuery };
  }
}

// Create a list of services to query:
// 1. Filters provided services by searchString
// 2. Gets favoriteServicesToQuery from localStorage and filters them by searchString
// 3. Orders them correctly
function createListOfServicesToQuery(services: string[], ds: string, searchString: string) {
  if (!services?.length) {
    return [];
  }

  const matchString = searchString === '.+' ? '' : searchString;
  console.log('match string', matchString);

  const servicesToQuery = services.filter((service) => service.toLowerCase().includes(matchString.toLowerCase()));
  const favoriteServicesToQuery = getFavoriteServicesFromStorage(ds).filter(
    (service) => service.toLowerCase().includes(matchString.toLowerCase()) && servicesToQuery.includes(service)
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
      overflowY: 'scroll',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    searchField: css({
      marginTop: theme.spacing(1),
    }),
  };
}
