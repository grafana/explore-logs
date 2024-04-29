import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { DataFrame, GrafanaTheme2, reduceField, ReducerID, PanelData } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
  SceneVariable,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import {
  DrawStyle,
  Field,
  Icon,
  Input,
  LoadingPlaceholder,
  StackingMode,
  useStyles2,
  Text,
  TextLink,
} from '@grafana/ui';

import { SelectFieldButton } from '../Forms/SelectFieldButton';
import { explorationDS, VAR_DATASOURCE } from 'services/shared';
import { map, Observable } from 'rxjs';
import { ByLabelRepeater } from 'Components/ByLabelRepeater';
import { GrotError } from 'Components/GrotError';
import { getLiveTailControl, getLokiDatasource } from 'services/scenes';
import { getFavoriteServicesFromStorage } from 'services/store';
import { debounce } from 'lodash';

const LIMIT_SERVICES = 20;
const SERVICE_NAME = 'service_name';

interface ServiceSelectionComponentState extends SceneObjectState {
  // The body of the component
  body: SceneCSSGridLayout;
  // We query volume endpoint to get list of all services and order them by volume
  servicesByVolume?: string[];
  // Keeps track of whether service list is being fetched from volume endpoint
  areServicesLoading: boolean;
  // Keeps track of the search query in input field
  searchServicesString: string;
  // List of services to be shown in the body
  servicesToQuery?: string[];
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
  private _services: Record<string, ServiceItem> = {};

  constructor(state: Partial<ServiceSelectionComponentState>) {
    super({
      body: new SceneCSSGridLayout({ children: [] }),
      areServicesLoading: false,
      servicesByVolume: undefined,
      searchServicesString: '',
      servicesToQuery: undefined,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this._getServicesByVolume();
    this.subscribeToState((newState, oldState) => {
      // Updates servicesToQuery when servicesByVolume is changed - should happen only once when the list of services is fetched during initialization
      if (newState.servicesByVolume !== oldState.servicesByVolume) {
        const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
        const servicesToQuery = addFavoriteServices(
          newState.servicesByVolume?.slice(0, LIMIT_SERVICES) ?? [],
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
        let servicesToQuery = services?.slice(0, LIMIT_SERVICES) ?? [];
        // If user is not searching for anything, add favorite services to the top
        if (newState.searchServicesString === '') {
          const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
          servicesToQuery = addFavoriteServices(servicesToQuery, getFavoriteServicesFromStorage(ds));
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
      areServicesLoading: true,
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
        areServicesLoading: false,
      });
    } catch (error) {
      console.log(`Failed to fetch top services:`, error);
      this.setState({
        servicesByVolume: [],
        areServicesLoading: false,
      });
    }
  }

  private updateBody() {
    const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue() as string;
    if (!this.state.servicesToQuery || this.state.servicesToQuery.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      this.state.body.setState({
        children: [
          new ByLabelRepeater({
            $data: new SceneDataTransformer({
              $data: new SceneQueryRunner({
                datasource: explorationDS,
                queries: [buildVolumeQuery(this.state.servicesToQuery)],
                maxDataPoints: 80,
              }),
              transformations: [
                () => (source: Observable<DataFrame[]>) => {
                  const favoriteServices = getFavoriteServicesFromStorage(ds);

                  return source.pipe(
                    map((data: DataFrame[]) => {
                      data.forEach((a) => reduceField({ field: a.fields[1], reducers: [ReducerID.max] }));
                      return data.sort((a, b) => {
                        const aService = a.fields?.[1]?.labels?.[SERVICE_NAME] ?? '';
                        const bService = b.fields?.[1]?.labels?.[SERVICE_NAME] ?? '';
                        const aIsFavorite = favoriteServices.includes(aService);
                        const bIsFavorite = favoriteServices.includes(bService);
                        if (aIsFavorite && !bIsFavorite) {
                          return -1;
                        } else if (!aIsFavorite && bIsFavorite) {
                          return 1;
                        } else if (aIsFavorite && bIsFavorite) {
                          if (favoriteServices.indexOf(aService) < favoriteServices.indexOf(bService)) {
                            return -1;
                          }
                          return 1;
                        } else {
                          return (b.fields[1].state?.calcs?.max || 0) - (a.fields[1].state?.calcs?.max || 0);
                        }
                      });
                    })
                  );
                },
              ],
            }),
            body: new SceneFlexLayout({
              height: '200px',
              direction: 'column',
              children: [
                new SceneFlexItem({
                  body: new SceneReactObject({
                    reactNode: <LoadingPlaceholder text="Fetching services..." />,
                  }),
                }),
              ],
            }),
            repeatByLabel: SERVICE_NAME,
            getLayoutChild: this.getLayoutChild.bind(this),
          }),
        ],
      });
    }
  }

  private getLayoutChild(data: PanelData, frames: DataFrame[], service: string, frameIndex: number): SceneFlexItem {
    if (this._services[service]) {
      this._services[service].volumePanel.setState({
        $data: new SceneDataNode({ data: { ...data, series: frames } }),
      });
      return this._services[service].layout;
    }
    const volumePanel = PanelBuilders.timeseries()
      .setTitle(service)
      .setData(new SceneDataNode({ data: { ...data, series: frames } }))
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
      .build();

    const logsQueryRunner = new SceneQueryRunner({
      datasource: explorationDS,
      queries: [buildLogsQuery(service, this.state.servicesByVolume)],
      maxDataPoints: 80,
      liveStreaming: getLiveTailControl(this)?.state.liveStreaming,
    });

    const logsPanel = PanelBuilders.logs().setData(logsQueryRunner).setOption('showTime', true).build();

    const layout = new SceneFlexItem({
      body: new SceneFlexLayout({
        height: '200px',
        direction: 'row',
        children: [
          new SceneFlexItem({
            width: '30%',
            md: {
              width: '100%',
            },
            body: volumePanel,
          }),
          new SceneFlexItem({
            width: '70%',
            md: {
              width: '100%',
            },
            body: logsPanel,
          }),
        ],
      }),
    });

    this._services[service] = {
      volumePanel,
      logsPanel,
      logsQueryRunner,
      layout,
    };

    return layout;
  }

  // We could also run model.setState in component, but it is recommended to implement the state-modifying methods in the scene object
  public onSearchServicesChange = debounce((serviceString: string) => {
    this.setState({
      searchServicesString: serviceString,
    });
  }, 500);

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionComponent>) => {
    const styles = useStyles2(getStyles);
    const { areServicesLoading, servicesToQuery, servicesByVolume, body } = model.useState();

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
            {areServicesLoading && <LoadingPlaceholder text={'Loading'} className={styles.loadingText} />}
            {!areServicesLoading && (
              <>
                Showing: {servicesToQuery?.length} of {servicesByVolume?.length} services
              </>
            )}
          </div>
          <Field className={styles.searchField}>
            <Input
              value={searchQuery}
              prefix={<Icon name="search" />}
              placeholder="Search services"
              onChange={onSearchChange}
            />
          </Field>
          {areServicesLoading && <LoadingPlaceholder text="Fetching services..." />}
          {!areServicesLoading && (!servicesToQuery || servicesToQuery.length === 0) && (
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
          {!areServicesLoading && servicesToQuery && servicesToQuery.length > 0 && (
            <div className={styles.body}>
              <body.Component model={body} />
            </div>
          )}
        </div>
      </div>
    );
  };
}

function buildBaseExpr(service: string | undefined, topServices: string[] | undefined) {
  const servicesLogQl = topServices && topServices.length > 0 ? topServices.join('|') : '.+';
  return `{${SERVICE_NAME}${service ? `="${service}"` : `=~"${servicesLogQl}"`}}`;
}

function buildLogsQuery(service: string | undefined, topServices: string[] | undefined) {
  return {
    refId: 'A',
    expr: buildBaseExpr(service, topServices),
    queryType: 'range',
    legendFormat: '{{level}}',
    maxLines: 100,
  };
}

function buildVolumeQuery(services: string[]) {
  const stream = `${SERVICE_NAME}=~"${services.join('|')}"`;
  return {
    refId: 'A',
    expr: `sum by(${SERVICE_NAME}, level) (count_over_time({${stream}} | drop __error__ [$__auto]))`,
    queryType: 'range',
    legendFormat: '{{level}}',
    maxLines: 100,
  };
}

function addFavoriteServices(services: string[], favoriteServices: string[]) {
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

interface ServiceItem {
  volumePanel: VizPanel;
  logsPanel: VizPanel;
  logsQueryRunner: SceneQueryRunner;
  layout: SceneFlexItem;
}
