import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useState } from 'react';
import { BusEventBase, DashboardCursorSync, GrafanaTheme2, TimeRange } from '@grafana/data';
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
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { DrawStyle, Field, Icon, Input, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { getLokiDatasource } from 'services/scenes';
import { getFavoriteServicesFromStorage } from 'services/store';
import { testIds } from 'services/testIds';
import { LEVEL_VARIABLE_VALUE, VAR_DATASOURCE, VAR_FILTERS } from 'services/variables';
import { SelectServiceButton } from './SelectServiceButton';
import { PLUGIN_ID } from 'services/routing';
import { buildLokiQuery } from 'services/query';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { ConfigureVolumeError } from './ConfigureVolumeError';

export const SERVICE_NAME = 'service_name';

interface ServiceSelectionComponentState extends SceneObjectState {
  // The body of the component
  body: SceneCSSGridLayout;
  // We query volume endpoint to get list of all services and order them by volume
  servicesByVolume?: string[];
  // Keeps track of whether service list is being fetched from volume endpoint
  isServicesByVolumeLoading: boolean;
  // Keeps track of the search query in input field
  searchServicesString: string;
  // List of services to be shown in the body
  servicesToQuery?: string[];
}

export class StartingPointSelectedEvent extends BusEventBase {
  public static type = 'start-point-selected-event';
}

export class ServiceSelectionComponent extends SceneObjectBase<ServiceSelectionComponentState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    // We want to subscribe to changes in datasource variables and update the top services when the datasource changes
    variableNames: [VAR_DATASOURCE],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;
      if (name === VAR_DATASOURCE) {
        // If datasource changes, we need to fetch services by volume for the new datasource
        this.getServicesByVolume();
      }
    },
  });

  constructor(state: Partial<ServiceSelectionComponentState>) {
    super({
      body: new SceneCSSGridLayout({ children: [] }),
      isServicesByVolumeLoading: false,
      servicesByVolume: undefined,
      searchServicesString: '',
      servicesToQuery: undefined,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // Clear all adhoc filters when the scene is activated, if there are any
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (variable instanceof AdHocFiltersVariable && variable.state.filters.length > 0) {
      variable.setState({
        filters: [],
      });
    }
    // On activation, fetch services by volume
    this.getServicesByVolume();
    this.subscribeToState((newState, oldState) => {
      // Updates servicesToQuery when servicesByVolume is changed
      if (newState.servicesByVolume !== oldState.servicesByVolume) {
        const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString();
        let servicesToQuery: string[] = [];
        if (ds && newState.servicesByVolume) {
          servicesToQuery = createListOfServicesToQuery(newState.servicesByVolume, ds, this.state.searchServicesString);
        }
        this.setState({
          servicesToQuery,
        });
      }

      // Updates servicesToQuery when searchServicesString is changed
      if (newState.searchServicesString !== oldState.searchServicesString) {
        const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue()?.toString();
        let servicesToQuery: string[] = [];
        if (ds && this.state.servicesByVolume) {
          servicesToQuery = createListOfServicesToQuery(this.state.servicesByVolume, ds, newState.searchServicesString);
        }
        this.setState({
          servicesToQuery,
        });
      }

      // When servicesToQuery is changed, update the body and render the panels with the new services
      if (newState.servicesToQuery !== oldState.servicesToQuery) {
        this.updateBody();
      }
    });

    sceneGraph.getTimeRange(this).subscribeToState((newTime, oldTime) => {
      if (shouldUpdateServicesByVolume(newTime.value, oldTime.value)) {
        this.getServicesByVolume();
      }
    });
  }

  // Run to fetch services by volume
  private async getServicesByVolume() {
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    this.setState({
      isServicesByVolumeLoading: true,
    });
    const ds = await getLokiDatasource(this);
    if (!ds) {
      return;
    }

    try {
      const volumeResponse = await ds.getResource!(
        'index/volume',
        {
          query: `{${SERVICE_NAME}=~".+"}`,
          from: timeRange.from.utc().toISOString(),
          to: timeRange.to.utc().toISOString(),
        },
        {
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      const serviceMetrics: { [key: string]: number } = {};
      volumeResponse.data.result.forEach((item: any) => {
        const serviceName = item['metric'][SERVICE_NAME];
        const value = Number(item['value'][1]);
        serviceMetrics[serviceName] = value;
      });

      const servicesByVolume = Object.entries(serviceMetrics)
        .sort((a, b) => b[1] - a[1]) // Sort by value in descending order
        .map(([serviceName]) => serviceName); // Extract service names

      this.setState({
        servicesByVolume,
        isServicesByVolumeLoading: false,
      });
    } catch (error) {
      console.log(`Failed to fetch top services:`, error);
      this.setState({
        servicesByVolume: [],
        isServicesByVolumeLoading: false,
      });
    }
  }

  private updateBody() {
    // If no services are to be queried, clear the body
    if (!this.state.servicesToQuery || this.state.servicesToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      // If we have services to query, build the layout with the services. Children is an array of layouts for each service (1 row with 2 columns - timeseries and logs panel)
      const children = [];
      const timeRange = sceneGraph.getTimeRange(this).state.value;
      for (const service of this.state.servicesToQuery) {
        // for each service, we create a layout with timeseries and logs panel
        children.push(this.buildServiceLayout(service, timeRange), this.buildServiceLogsLayout(service));
      }
      this.state.body.setState({
        children: [
          new SceneCSSGridLayout({
            children,
            isLazy: true,
            templateColumns: 'repeat(auto-fit, minmax(400px, 1fr) minmax(600px, 70%))',
            autoRows: '200px',
            md: {
              templateColumns: '1fr',
              rowGap: 1,
              columnGap: 1,
            },
          }),
        ],
      });
    }
  }

  // Creates a layout with timeseries panel
  buildServiceLayout(service: string, timeRange: TimeRange) {
    let splitDuration;
    if (timeRange.to.diff(timeRange.from, 'hours') >= 4 && timeRange.to.diff(timeRange.from, 'hours') <= 26) {
      splitDuration = '2h';
    }
    return new SceneCSSGridItem({
      $behaviors: [new behaviors.CursorSync({ key: 'serviceCrosshairSync', sync: DashboardCursorSync.Crosshair })],
      body: PanelBuilders.timeseries()
        // If service was previously selected, we show it in the title
        .setTitle(service)
        .setData(
          getQueryRunner(
            buildLokiQuery(
              `sum by (${LEVEL_VARIABLE_VALUE}) (count_over_time({${SERVICE_NAME}=\`${service}\`} | drop __error__ [$__auto]))`,
              { legendFormat: `{{${LEVEL_VARIABLE_VALUE}}}`, splitDuration }
            )
          )
        )
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
        .setOverrides(setLeverColorOverrides)
        .setOption('legend', { showLegend: false })
        .setHeaderActions(new SelectServiceButton({ service }))
        .build(),
    });
  }

  // Creates a layout with logs panel
  buildServiceLogsLayout(service: string) {
    return new SceneCSSGridItem({
      body: PanelBuilders.logs()
        // Hover header set to true removes unused header padding, displaying more logs
        .setHoverHeader(true)
        .setData(getQueryRunner(buildLokiQuery(`{${SERVICE_NAME}=\`${service}\`}`, { maxLines: 100 })))
        .setOption('showTime', true)
        .setOption('enableLogDetails', false)
        .build(),
    });
  }

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  public onSearchServicesChange = debounce((serviceString: string) => {
    this.setState({
      searchServicesString: serviceString,
    });
    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.search_services_changed,
      {
        searchQuery: serviceString,
      }
    );
  }, 500);

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionComponent>) => {
    const styles = useStyles2(getStyles);
    const { isServicesByVolumeLoading, servicesByVolume, servicesToQuery, body } = model.useState();

    // searchQuery is used to keep track of the search query in input field
    const [searchQuery, setSearchQuery] = useState('');
    const onSearchChange = useCallback(
      (e: React.FormEvent<HTMLInputElement>) => {
        setSearchQuery(e.currentTarget.value);
        model.onSearchServicesChange(e.currentTarget.value);
      },
      [model]
    );
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
            <Input
              data-testid={testIds.exploreService.search}
              value={searchQuery}
              prefix={<Icon name="search" />}
              placeholder="Search services"
              onChange={onSearchChange}
            />
          </Field>
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isServicesByVolumeLoading && !servicesByVolume?.length && <ConfigureVolumeError />}
          {!isServicesByVolumeLoading && servicesToQuery && servicesToQuery.length > 0 && (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </div>
    );
  };
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
  const favoriteServicesToQuery = getFavoriteServicesFromStorage(ds).filter((service) =>
    service.toLowerCase().includes(searchString.toLowerCase())
  );

  // Deduplicate
  return Array.from(new Set([...favoriteServicesToQuery, ...servicesToQuery]));
}

function shouldUpdateServicesByVolume(newTime: TimeRange, oldTime: TimeRange) {
  // Update if the time range is not within the same scope (hours vs. days)
  if (newTime.to.diff(newTime.from, 'days') > 1 !== oldTime.to.diff(oldTime.from, 'days') > 1) {
    return true;
  }
  // Update if the time range is less than 6 hours and the difference between the old and new 'from' and 'to' times is greater than 30 minutes
  if (newTime.to.diff(newTime.from, 'hours') < 6 && timeDiffBetweenRangesLargerThan(newTime, oldTime, 'minutes', 30)) {
    return true;
  }
  // Update if the time range is less than 1 day and the difference between the old and new 'from' and 'to' times is greater than 1 hour
  if (newTime.to.diff(newTime.from, 'days') < 1 && timeDiffBetweenRangesLargerThan(newTime, oldTime, 'hours', 1)) {
    return true;
  }
  // Update if the time range is more than 1 day and the difference between the old and new 'from' and 'to' times is greater than 1 day
  if (newTime.to.diff(newTime.from, 'days') > 1 && timeDiffBetweenRangesLargerThan(newTime, oldTime, 'days', 1)) {
    return true;
  }

  return false;
}

// Helper function to check if difference between two time ranges is larger than value
function timeDiffBetweenRangesLargerThan(
  newTimeRange: TimeRange,
  oldTimeRange: TimeRange,
  unit: 'minutes' | 'hours' | 'days',
  value: number
) {
  const toChange =
    newTimeRange.to.diff(oldTimeRange.to, unit) > value || newTimeRange.to.diff(oldTimeRange.to, unit) < -value;
  const fromChange =
    newTimeRange.from.diff(oldTimeRange.from, unit) > value || newTimeRange.from.diff(oldTimeRange.from, unit) < -value;
  return toChange || fromChange;
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
