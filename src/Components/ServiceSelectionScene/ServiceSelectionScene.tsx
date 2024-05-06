import { css } from '@emotion/css';
import { debounce } from 'lodash';
import React, { useCallback, useState } from 'react';

import { BusEventBase, GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import {
  DrawStyle,
  Field,
  Icon,
  Input,
  LoadingPlaceholder,
  StackingMode,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';
import { getLokiDatasource } from 'services/scenes';
import { getFavoriteServicesFromStorage } from 'services/store';
import { testIds } from 'services/testIds';
import { explorationDS, VAR_DATASOURCE, VAR_FILTERS } from 'services/variables';
import { GrotError } from '../GrotError';
import { SelectFieldButton } from './SelectFieldButton';
import { PLUGIN_ID } from 'services/routing';

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
        this._getServicesByVolume();
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
    this._getServicesByVolume();
    this.subscribeToState((newState, oldState) => {
      // Updates servicesToQuery when servicesByVolume is changed - should happen only once when the list of services is fetched during initialization
      if (newState.servicesByVolume !== oldState.servicesByVolume) {
        const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
        const servicesToQuery = createListOfServicesToQuery(
          newState.servicesByVolume ?? [],
          getFavoriteServicesFromStorage(ds)
        );
        this.setState({
          servicesToQuery,
        });
      }

      // Updates servicesToQuery when searchServicesString is changed
      if (newState.searchServicesString !== oldState.searchServicesString) {
        const services = this.state.servicesByVolume?.filter((service) =>
          service.toLowerCase().includes(newState.searchServicesString?.toLowerCase() ?? '')
        );
        let servicesToQuery = services ?? [];
        // If user is not searching for anything, add favorite services to the top
        if (newState.searchServicesString === '') {
          const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
          servicesToQuery = createListOfServicesToQuery(servicesToQuery, getFavoriteServicesFromStorage(ds));
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
  }

  // Run on initialization to fetch list of services ordered by volume
  private async _getServicesByVolume() {
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    this.setState({
      isServicesByVolumeLoading: true,
    });
    const ds = await getLokiDatasource(this);
    if (!ds) {
      return;
    }

    try {
      const volumeResponse = await ds.getResource!('index/volume', {
        query: `{${SERVICE_NAME}=~".+"}`,
        from: timeRange.from.utc().toISOString(),
        to: timeRange.to.utc().toISOString(),
      });
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
      for (const service of this.state.servicesToQuery) {
        // for each service, we create a layout with timeseries and logs panel
        children.push(this.buildServiceLayout(service), this.buildServiceLogsLayout(service));
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
  buildServiceLayout(service: string) {
    return new SceneCSSGridItem({
      body: PanelBuilders.timeseries()
        // If service was previously selected, we show it in the title
        .setTitle(service)
        .setData(
          new SceneQueryRunner({
            datasource: explorationDS,
            queries: [
              // Volume of logs for service grouped by level
              buildVolumeQuery(service),
            ],
          })
        )
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
        .setOverrides((overrides) => {
          overrides.matchFieldsWithName('info').overrideColor({
            mode: 'fixed',
            fixedColor: 'semi-dark-green',
          });
          overrides.matchFieldsWithName('debug').overrideColor({
            mode: 'fixed',
            fixedColor: 'semi-dark-blue',
          });
          overrides.matchFieldsWithName('error').overrideColor({
            mode: 'fixed',
            fixedColor: 'semi-dark-red',
          });
          overrides.matchFieldsWithName('warn').overrideColor({
            mode: 'fixed',
            fixedColor: 'semi-dark-orange',
          });
        })
        .setOption('legend', { showLegend: false })
        .setHeaderActions(new SelectFieldButton({ value: service }))
        .build(),
    });
  }

  // Creates a layout with logs panel
  buildServiceLogsLayout(service: string) {
    return new SceneCSSGridItem({
      body: PanelBuilders.logs()
        .setData(
          new SceneQueryRunner({
            datasource: explorationDS,
            queries: [buildLogQuery(service)],
          })
        )
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
            {/** This is on top to show that we are loading Showing: X of X services div */}
            {isServicesByVolumeLoading && <LoadingPlaceholder text={'Loading'} className={styles.loadingText} />}
            {!isServicesByVolumeLoading && <>Showing {servicesToQuery?.length} services</>}
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
          {isServicesByVolumeLoading && <LoadingPlaceholder text="Fetching services..." />}
          {/** If we don't have any servicesByVolume, volume endpoint is probably not enabled */}
          {!isServicesByVolumeLoading && !servicesByVolume?.length && (
            <GrotError>
              <p>Log volume has not been configured.</p>
              <p>
                <TextLink href="https://grafana.com/docs/loki/latest/reference/api/#query-log-volume" external>
                  Instructions to enable volume in the Loki config:
                </TextLink>
              </p>
              <Text textAlignment="left">
                <pre>
                  <code>
                    limits_config:
                    <br />
                    &nbsp;&nbsp;volume_enabled: true
                  </code>
                </pre>
              </Text>
            </GrotError>
          )}
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

function buildVolumeQuery(service: string) {
  return {
    refId: 'A',
    expr: `sum by(level) (count_over_time({${SERVICE_NAME}=\`${service}\`} | drop __error__ [$__auto]))`,
    queryType: 'range',
    legendFormat: '{{level}}',
    supportingQueryType: PLUGIN_ID,
  };
}

function buildLogQuery(service: string) {
  return {
    refId: 'A',
    expr: `{${SERVICE_NAME}=\`${service}\`}`,
    supportingQueryType: PLUGIN_ID,
    queryType: 'range',
    maxLines: 100,
  };
}

// Helper function to create a list of services to query. We want to show favorite services first and remove duplicates.
// If there are no services, we return an empty array (don't want to use favorite services if there are no services)
function createListOfServicesToQuery(services: string[], favoriteServices: string[]) {
  if (!services.length) {
    return [];
  }
  const set = new Set([...favoriteServices, ...services]);
  return Array.from(set);
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
