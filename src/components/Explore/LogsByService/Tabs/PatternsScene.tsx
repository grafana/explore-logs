import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldType, GrafanaTheme2, LoadingState, dateTime } from '@grafana/data';
import {
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexItemLike,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Button, DrawStyle, StackingMode, useStyles2 } from '@grafana/ui';

import { StatusWrapper } from '../../StatusWrapper';
import { VAR_LABEL_GROUP_BY } from '../../../../utils/shared';

import { AddToFiltersGraphAction } from '../../AddToFiltersGraphAction';
import { LayoutSwitcher } from '../../LayoutSwitcher';
import { getColorByIndex } from '../../../../utils/utils';
import { AddToPatternsGraphAction } from './AddToPatternsGraphAction';
import { LogsByServiceScene } from '../LogsByServiceScene';

export interface PatternsSceneState extends SceneObjectState {
  body?: SceneObject;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
}

export class PatternsScene extends SceneObjectBase<PatternsSceneState> {
  constructor(state: Partial<PatternsSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this.updateBody();
    const unsub = sceneGraph.getAncestor(this, LogsByServiceScene).subscribeToState((newState, prevState) => {
      if (newState.patterns !== prevState.patterns) {
        this.updateBody();
      }
    });
    return () => unsub.unsubscribe();
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private async updateBody() {
    const children: SceneFlexItemLike[] = [];

    const patterns = sceneGraph.getAncestor(this, LogsByServiceScene).state.patterns;
    if (!patterns) {
      return;
    }

    let maxValue = -Infinity;
    let minValue = 0;

    patterns
      .sort((a, b) => b.matches - a.matches)
      .slice(0, 40)
      .forEach((pat, frameIndex) => {
        const start = pat.volumeTimeSeries[0][0] * 1000;
        const end = pat.volumeTimeSeries[pat.volumeTimeSeries.length - 1][0] * 1000;
        const dataFrame: DataFrame = {
          refId: pat.pattern,
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: pat.volumeTimeSeries.map((sample) => sample[0] * 1000),
              config: {},
            },
            {
              name: pat.pattern,
              type: FieldType.number,
              values: pat.volumeTimeSeries.map((sample) => {
                const f = parseFloat(sample[1]);
                if (f > maxValue) {
                  maxValue = f;
                }
                if (f < minValue) {
                  minValue = f;
                }
                return f;
              }),
              config: {},
            },
          ],
          length: pat.volumeTimeSeries.length,
          meta: {
            preferredVisualisationType: 'graph',
          },
        };
        children.push(
          new SceneCSSGridItem({
            body: PanelBuilders.timeseries()
              .setTitle(pat.pattern)
              .setOption('legend', { showLegend: false })
              .setData(
                new SceneDataNode({
                  data: {
                    series: [dataFrame],
                    state: LoadingState.Done,
                    timeRange: {
                      from: dateTime(start),
                      to: dateTime(end),
                      raw: { from: dateTime(start), to: dateTime(end) },
                    },
                  },
                })
              )
              .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
              .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
              .setCustomFieldConfig('fillOpacity', 100)
              .setCustomFieldConfig('lineWidth', 0)
              .setCustomFieldConfig('pointSize', 0)
              .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
              .setCustomFieldConfig('axisSoftMax', maxValue)
              .setCustomFieldConfig('axisSoftMin', minValue)
              .setHeaderActions([
                new AddToPatternsGraphAction({ pattern: pat.pattern, type: 'exclude' }),
                new AddToPatternsGraphAction({ pattern: pat.pattern, type: 'include' }),
              ])
              .build(),
          })
        );
      });

    this.setState({
      body: new LayoutSwitcher({
        options: [
          { value: 'grid', label: 'Grid' },
          { value: 'rows', label: 'Rows' },
        ],
        active: 'grid',
        layouts: [
          new SceneCSSGridLayout({
            templateColumns: GRID_TEMPLATE_COLUMNS,
            autoRows: '200px',
            children: children,
          }),
          new SceneCSSGridLayout({
            templateColumns: '1fr',
            autoRows: '200px',
            children: children,
          }),
        ],
      }),
    });
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<PatternsScene>) => {
    const { body, loading, blockingMessage } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {body instanceof LayoutSwitcher && (
              <div className={styles.controlsRight}>
                <body.Selector model={body} />
              </div>
            )}
          </div>
          <div className={styles.content}>{body && <body.Component model={body} />}</div>
        </StatusWrapper>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 0,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    controlsLeft: css({
      display: 'flex',
      justifyContent: 'flex-left',
      justifyItems: 'left',
      width: '100%',
      flexDirection: 'column',
    }),
  };
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(600px, 1fr))';

export function buildPatternsScene() {
  return new SceneFlexItem({
    body: new PatternsScene({}),
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getPatternsSceneFor(this).onChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="primary" size="sm" fill="text" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}

function getPatternsSceneFor(model: SceneObject): PatternsScene {
  if (model instanceof PatternsScene) {
    return model;
  }

  if (model.parent) {
    return getPatternsSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
