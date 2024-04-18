import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { DataFrame, GrafanaTheme2, reduceField, ReducerID, PanelData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
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
  //SceneVariableSet,
  VariableDependencyConfig,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, Field, Icon, Input, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';

import { SelectFieldButton } from '../misc/SelectFieldButton';
import { explorationDS, VAR_DATASOURCE, VAR_FILTERS } from '../../utils/shared';
import { map, Observable, Unsubscribable } from 'rxjs';
import { ByLabelRepeater } from 'components/misc/ByLabelRepeater';
import { getLiveTailControl } from 'utils/scenes';
import { getFavoriteServicesFromStorage } from 'utils/store';

const LIMIT_SERVICES = 20;
const SERVICE_NAME = 'service_name';

interface ServiceSelectionComponentState extends SceneObjectState {
  body: SceneCSSGridLayout;
  repeater?: ByLabelRepeater;
  groupBy: string;
  metricFn: string;

  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
  topServices?: string[];
  isTopSeriesLoading: boolean;
  searchServicesString: string;
  topServicesToBeUsed?: string[];
}

export class ServiceSelectionComponent extends SceneObjectBase<ServiceSelectionComponentState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS, VAR_DATASOURCE],
    onReferencedVariableValueChanged: async (variable: SceneVariable) => {
      const { name } = variable.state;
      if (name === VAR_DATASOURCE) {
        this._onTopServiceChange();
      }
    },
  });
  private _services: Record<string, ServiceItem> = {};

  constructor(state: Partial<ServiceSelectionComponentState>) {
    super({
      // $variables: state.$variables ?? getVariableSet(),
      showPreviews: true,
      groupBy: state.groupBy ?? 'resource.service.name',
      metricFn: state.metricFn ?? 'rate()',
      body: new SceneCSSGridLayout({ children: [] }),
      isTopSeriesLoading: false,
      topServices: undefined,
      searchServicesString: '',
      topServicesToBeUsed: undefined,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // terribad hack - remove single service filter if it's there
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (variable instanceof AdHocFiltersVariable && variable.state.filters.find((f) => f.key === SERVICE_NAME)) {
      variable.setState({
        filters: variable.state.filters.filter((f) => f.key !== SERVICE_NAME),
      });
    }

    const unsubs: Unsubscribable[] = [];

    const liveTailControl = getLiveTailControl(this);
    if (liveTailControl) {
      unsubs.push(
        liveTailControl.subscribeToState(({ liveStreaming }) => {
          Object.values(this._services).forEach((service) => {
            service.logsQueryRunner.setState({
              liveStreaming,
              queries: [...service.logsQueryRunner.state.queries],
            });
            service.logsQueryRunner.runQueries();
          });
        })
      );
    }

    this._onTopServiceChange();

    this.subscribeToState((newState, oldState) => {
      if (newState.topServicesToBeUsed !== oldState.topServicesToBeUsed) {
        this.updateBody();
      }

      // Updates topServicesToBeUsed when searchServicesString is changed
      if (newState.searchServicesString !== oldState.searchServicesString) {
        const services = this.state.topServices?.filter((service) =>
          service.toLowerCase().includes(newState.searchServicesString?.toLowerCase() ?? '')
        );
        let topServicesToBeUsed = services?.slice(0, LIMIT_SERVICES) ?? [];
        // If user is not searching for anything, add favorite services to the top
        if (newState.searchServicesString === '') {
          const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
          topServicesToBeUsed = addFavoriteServices(topServicesToBeUsed, getFavoriteServicesFromStorage(ds));
        }
        this.setState({
          topServicesToBeUsed,
        });
      }
    });

    return () => unsubs.forEach((u) => u.unsubscribe());
  }

  private _onTopServiceChange() {
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
    this.setState({
      isTopSeriesLoading: true,
    });

    getDataSourceSrv()
      .get(ds as string)
      .then((datasourceInstance) => {
        // @ts-ignore
        datasourceInstance.getResource!('index/volume', {
          query: `{${SERVICE_NAME}=~".+"}`,
          from: timeRange.from.utc().toISOString(),
          to: timeRange.to.utc().toISOString(),
        })
          .then((res: any) => {
            const serviceMetrics: { [key: string]: number } = {};
            res.data.result.forEach((item: any) => {
              const serviceName = item['metric'][SERVICE_NAME];
              const value = Number(item['value'][1]);
              serviceMetrics[serviceName] = value;
            });

            const topServices = Object.entries(serviceMetrics)
              .sort((a, b) => b[1] - a[1]) // Sort by value in descending order
              .map(([serviceName]) => serviceName); // Extract service names

            // this is run to get initial services + and we are adding favorite services
            let topServicesToBeUsed = addFavoriteServices(
              topServices.slice(0, LIMIT_SERVICES),
              getFavoriteServicesFromStorage(ds)
            );
            this.setState({
              topServices,
              topServicesToBeUsed,
              isTopSeriesLoading: false,
            });
          })
          .catch((err: any) => {
            console.error('Could not fetch volume', err);
            this.setState({
              topServices: [],
              topServicesToBeUsed: [],
              isTopSeriesLoading: false,
            });
          });
      });
  }

  public getRepeater(): ByLabelRepeater {
    return this.state.body!.state.children[0] as ByLabelRepeater;
  }

  private updateBody() {
    const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue() as string;
    if (!this.state.topServicesToBeUsed || this.state.topServicesToBeUsed.length === 0) {
      this.state.body.setState({ children: [] });
    } else {
      this.state.body.setState({
        children: [
          new ByLabelRepeater({
            $data: new SceneDataTransformer({
              $data: new SceneQueryRunner({
                datasource: explorationDS,
                queries: [buildVolumeQuery(this.state.topServicesToBeUsed)],
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
      queries: [buildLogsQuery(service, this.state.topServices)],
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
            body: volumePanel,
          }),
          new SceneFlexItem({
            width: '70%',
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

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionComponent>) => {
    const styles = useStyles2(getStyles);
    const { isTopSeriesLoading, topServicesToBeUsed, topServices } = model.useState();

    const body = model.state.body;

    const [searchQuery, setSearchQuery] = useState('');

    const timeout = useRef<NodeJS.Timeout>();

    const onSearchChange = useCallback(
      (e: React.FormEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        setSearchQuery(value);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          model.setState({ searchServicesString: value });
        }, 700);
      },
      [model]
    );
    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          <div>
            {isTopSeriesLoading && <LoadingPlaceholder text={'Loading'} className={styles.loadingText} />}
            {!isTopSeriesLoading && (
              <>
                Showing: {topServicesToBeUsed?.length} of {topServices?.length} services
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
          {isTopSeriesLoading && <LoadingPlaceholder text="Fetching services..." />}
          {!isTopSeriesLoading && (!topServicesToBeUsed || topServicesToBeUsed.length === 0) && (
            <div>No services found</div>
          )}
          {!isTopSeriesLoading && topServicesToBeUsed && topServicesToBeUsed.length > 0 && (
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
