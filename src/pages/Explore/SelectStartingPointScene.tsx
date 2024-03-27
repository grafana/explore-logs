import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';

import { DataFrame, GrafanaTheme2, reduceField, ReducerID, PanelData } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
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
  //SceneVariableSet,
  VariableDependencyConfig,
  VariableValue,
  VizPanel,
} from '@grafana/scenes';
import { DrawStyle, Field, Icon, Input, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';

import { SelectAttributeWithValueAction } from './SelectAttributeWithValueAction';
import { explorationDS, VAR_FILTERS } from '../../utils/shared';
import { map, Observable, Unsubscribable } from 'rxjs';
import { ByLabelRepeater } from 'components/Explore/ByLabelRepeater';
import { getLiveTailControl } from 'utils/scenes';

export interface LogSelectSceneState extends SceneObjectState {
  body?: SceneCSSGridLayout;
  repeater?: ByLabelRepeater;
  groupBy: string;
  metricFn: string;

  showHeading?: boolean;
  searchQuery?: string;
  showPreviews?: boolean;
}

//const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

const VAR_METRIC_FN = 'fn';
//const VAR_METRIC_FN_EXPR = '${fn}';

export class SelectStartingPointScene extends SceneObjectBase<LogSelectSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
  });

  private _services: Record<string, ServiceItem> = {};

  constructor(state: Partial<LogSelectSceneState>) {
    super({
      // $variables: state.$variables ?? getVariableSet(),
      showPreviews: true,
      groupBy: state.groupBy ?? 'resource.service.name',
      metricFn: state.metricFn ?? 'rate()',
      ...state,
    });

    this.setState({
      body: this.buildBody(),
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    // terribad hack - remove single service filter if it's there
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (variable instanceof AdHocFiltersVariable && variable.state.filters.find((f) => f.key === 'service_name')) {
      variable.setState({
        filters: variable.state.filters.filter((f) => f.key !== 'service_name'),
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

    return () => unsubs.forEach((u) => u.unsubscribe());
  }

  public getRepeater(): ByLabelRepeater {
    return this.state.body!.state.children[0] as ByLabelRepeater;
  }

  private buildBody() {
    return new SceneCSSGridLayout({
      children: [
        new ByLabelRepeater({
          $data: new SceneDataTransformer({
            $data: new SceneQueryRunner({
              datasource: explorationDS,
              queries: [buildVolumeQuery()],
              maxDataPoints: 80,
            }),
            transformations: [
              () => (source: Observable<DataFrame[]>) => {
                return source.pipe(
                  map((data: DataFrame[]) => {
                    data.forEach((a) => reduceField({ field: a.fields[1], reducers: [ReducerID.max] }));
                    return data.sort((a, b) => {
                      return (b.fields[1].state?.calcs?.max || 0) - (a.fields[1].state?.calcs?.max || 0);
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
          repeatByLabel: 'service_name',
          getLayoutChild: this.getLayoutChild.bind(this),
        }),
      ],
    });
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
      .setHeaderActions(new SelectAttributeWithValueAction({ value: service }))
      .build();

    const logsQueryRunner = new SceneQueryRunner({
      datasource: explorationDS,
      queries: [buildLogsQuery(service)],
      maxDataPoints: 80,
      liveStreaming: getLiveTailControl(this)?.state.liveStreaming,
    });

    const logsPanel = PanelBuilders.logs().setData(logsQueryRunner).build();

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

  public getMetricFnVariable() {
    const variable = sceneGraph.lookupVariable(VAR_METRIC_FN, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Metric function variable not found');
    }

    return variable;
  }

  public onChangeMetricsFn = (value?: VariableValue) => {
    if (!value) {
      return;
    }
    const metricFnVariable = this.getMetricFnVariable();
    metricFnVariable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<SelectStartingPointScene>) => {
    const styles = useStyles2(getStyles);
    //const metricFnVariable = model.getMetricFnVariable();
    // const { value: metricFnValue } = metricFnVariable.useState();

    const body = model.state.body!;

    const [searchQuery, setSearchQuery] = useState(model.getRepeater().state.filter);

    const timeout = useRef<NodeJS.Timeout>();

    const onSearchChange = useCallback(
      (e: React.FormEvent<HTMLInputElement>) => {
        const value = e.currentTarget.value;
        setSearchQuery(value);
        clearTimeout(timeout.current);
        timeout.current = setTimeout(() => {
          model.getRepeater().setState({ filter: value });
        }, 500);
      },
      [model]
    );

    return (
      <div className={styles.container}>
        <div className={styles.bodyWrapper}>
          <Field className={styles.searchField}>
            <Input
              value={searchQuery}
              prefix={<Icon name="search" />}
              placeholder="Search services"
              onChange={onSearchChange}
            />
          </Field>
          <body.Component model={body} />
        </div>
      </div>
    );
  };
}

function buildBaseExpr(service?: string) {
  return `{service_name${service ? `="${service}"` : '=~".+"'}}`;
}

function buildLogsQuery(service?: string) {
  return {
    refId: 'A',
    expr: buildBaseExpr(service),
    queryType: 'range',
    legendFormat: '{{level}}',
  };
}

function buildVolumeQuery() {
  return {
    refId: 'A',
    expr: `sum by(service_name, level) (count_over_time(${buildBaseExpr()} [$__interval]))`,
    queryType: 'range',
    legendFormat: '{{level}}',
    maxLines: 100,
  };
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

      '& > div': {
        overflow: 'scroll',
      },
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
