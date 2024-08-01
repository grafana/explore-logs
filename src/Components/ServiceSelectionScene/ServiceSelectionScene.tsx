import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React from 'react';
import { DashboardCursorSync, DataFrame, GrafanaTheme2, LoadingState, TimeRange, VariableHide } from '@grafana/data';
import {
  behaviors,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataProvider,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
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
import { getFavoriteServicesFromStorage } from 'services/store';
import {
  getDataSourceVariable,
  getLabelsVariable,
  getServiceSelectionStringVariable,
  LEVEL_VARIABLE_VALUE,
  VAR_SERVICE,
  VAR_SERVICE_EXPR,
  VAR_SERVICE_EXPR_HACK,
} from 'services/variables';
import { selectService, SelectServiceButton } from './SelectServiceButton';
import { buildLokiQuery, buildResourceQuery } from 'services/query';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { ConfigureVolumeError } from './ConfigureVolumeError';
import { NoVolumeError } from './NoVolumeError';
import { getLabelsFromSeries, toggleLevelFromFilter } from 'services/levels';
import { ServiceFieldSelector } from '../ServiceScene/Breakdowns/FieldSelector';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import { areArraysEqual } from '../../services/comparison';

export const SERVICE_NAME = 'service_name';

interface ServiceSelectionSceneState extends SceneObjectState {
  // The body of the component
  body: SceneCSSGridLayout;

  volumeApiError?: boolean;
  // Show logs of a certain level for a given service
  serviceLevel: Map<string, string[]>;
  // Logs volume API response as dataframe with SceneQueryRunner
  $data: SceneDataProvider;
  logVolumeSeries?: DataFrame[];
  isLogVolumeLoading: boolean;
}

function getMetricExpression(service: string) {
  return `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({${SERVICE_NAME}=\`${service}\`} | drop __error__ [$__auto]))`;
}

function getLogExpression(service: string, levelFilter: string) {
  return `{${SERVICE_NAME}=\`${service}\`}${levelFilter}`;
}

export class ServiceSelectionScene extends SceneObjectBase<ServiceSelectionSceneState> {
  constructor(state: Partial<ServiceSelectionSceneState>) {
    super({
      body: new SceneCSSGridLayout({ children: [] }),
      $variables: new SceneVariableSet({
        variables: [
          new CustomConstantVariable({
            name: VAR_SERVICE,
            label: 'Service',
            hide: VariableHide.hideVariable,
            value: '',
            skipUrlSync: true,
          }),
        ],
      }),
      $data: getQueryRunner(
        buildResourceQuery(
          // passing in the hack string will force the query to be re-run when the datasource changes, we'll remove it before interpolating so it should have no impact on the actual query being executed
          `{${SERVICE_NAME}=~\`${VAR_SERVICE_EXPR}.+\` ${VAR_SERVICE_EXPR_HACK} }`,
          'volume'
        )
      ),
      serviceLevel: new Map<string, string[]>(),
      isLogVolumeLoading: true,
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
    serviceVariable.changeValueTo('');

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.logVolumeSeries, prevState.logVolumeSeries)) {
          this.updateBody();
        }
      })
    );

    this._subs.add(
      this.state.$data.subscribeToState((newState, prevState) => {
        let stateUpdate: Partial<ServiceSelectionSceneState> = {};
        const newServices = this.state.logVolumeSeries?.[0]?.fields?.find((f) => f.name === SERVICE_NAME);
        const prevServices = newState?.data?.series?.[0]?.fields?.find((f) => f.name === SERVICE_NAME);
        if (
          newState.data?.state === LoadingState.Done &&
          // We only want to re-render if the order of the services changed, if the volume was different, we don't want to re-render which will trigger additional queries
          // However this means if the order changes, we won't update the UI

          // Also note that when the time range is updated, that triggers all existing panels to requery with the new time range, but then we have to re-query again after the body is updated with a new list of services after the logs volume query returns
          // It is for this reason that we want to avoid updating the `logVolumeSeries` as much as possible
          // If we want the order of the services to update on time range change, we'll need a way to prevent the panels from updating immediately on time range change, and instead wait until the volume call returns
          !areArraysEqual(newServices?.values, prevServices?.values)
        ) {
          // Add new dataframes if changed!
          stateUpdate.logVolumeSeries = newState.data.series;
          stateUpdate.isLogVolumeLoading = false;
          stateUpdate.volumeApiError = false;
        } else if (newState.data?.state === LoadingState.Error) {
          stateUpdate.volumeApiError = true;
          stateUpdate.isLogVolumeLoading = false;
        } else if (newState.data?.state === LoadingState.Done) {
          stateUpdate.isLogVolumeLoading = false;
        }

        if (Object.keys(stateUpdate).length) {
          this.setState(stateUpdate);
        }
      })
    );
  }

  private updateBody() {
    const { servicesToQuery } = this.getServices(this.state.logVolumeSeries);
    // If no services are to be queried, clear the body
    if (!servicesToQuery || servicesToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // @todo update instead of overwrite? Then we can change order?
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
    const { servicesToQuery } = this.getServices(this.state.logVolumeSeries);
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
    // const timeRange = sceneGraph.getTimeRange(this).state.value;
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
              // range: timeRange
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
    variable.changeValueTo(serviceString ?? '');

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
    const { body, volumeApiError, logVolumeSeries, isLogVolumeLoading } = model.useState();

    const serviceStringVariable = getServiceSelectionStringVariable(model);
    const { value } = serviceStringVariable.useState();
    const { servicesByVolume, servicesToQuery } = model.getServices(logVolumeSeries);

    const onSearchChange = (serviceName: string) => {
      model.onSearchServicesChange(serviceName);
    };
    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          <div>
            {/** When services fetched, show how many services are we showing */}
            {isLogVolumeLoading && <LoadingPlaceholder text={'Loading services'} className={styles.loadingText} />}
            {!isLogVolumeLoading && <>Showing {servicesToQuery?.length ?? 0} services</>}
          </div>
          <Field className={styles.searchField}>
            <ServiceFieldSelector
              isLoading={isLogVolumeLoading}
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
          {!isLogVolumeLoading && volumeApiError && <ConfigureVolumeError />}
          {!isLogVolumeLoading && !volumeApiError && !servicesByVolume?.length && <NoVolumeError />}
          {!isLogVolumeLoading && servicesToQuery && servicesToQuery.length > 0 && (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </div>
    );
  };

  private getServices(series?: DataFrame[]) {
    const servicesByVolume: string[] =
      series?.[0]?.fields?.find((field) => field.name === 'service_name')?.values ?? [];
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
