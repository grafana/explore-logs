import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, FieldType, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Button, DrawStyle, StackingMode, Text, useStyles2 } from '@grafana/ui';

import { StatusWrapper } from '../../StatusWrapper';
import { VAR_LABEL_GROUP_BY } from '../../../../utils/shared';

import { AddToFiltersGraphAction } from '../../AddToFiltersGraphAction';
import { LayoutSwitcher } from '../../LayoutSwitcher';
import { getColorByIndex } from '../../../../utils/utils';
import { AddToPatternsGraphAction } from './AddToPatternsGraphAction';
import { LogsByServiceScene } from '../LogsByServiceScene';
import { GrotError } from '../../../GrotError';

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
    let combinedFrame: DataFrame | undefined;

    const patterns = sceneGraph.getAncestor(this, LogsByServiceScene).state.patterns;
    if (!patterns) {
      return;
    }

    let maxValue = -Infinity;
    let minValue = 0;

    const timeRange = sceneGraph.getTimeRange(this).state.value;

    patterns.slice(0, 40).forEach((pat, frameIndex) => {
      const valueField = {
        name: pat.pattern,
        type: FieldType.number,
        values: pat.samples.map((sample) => {
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
      };

      const timeSamples = pat.samples.map((sample) => sample[0] * 1000);

      if (!combinedFrame?.fields[0].name) {
        combinedFrame = {
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: timeSamples,
              config: {},
            },
          ],
          length: timeSamples.length,
        };
      }

      combinedFrame.fields.push(valueField);

      const dataFrame: DataFrame = {
        refId: pat.pattern,
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: pat.samples.map((sample) => sample[0] * 1000),
            config: {},
          },
          { ...valueField },
        ],
        length: pat.samples.length,
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
                  timeRange,
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

    const singleView = new SceneFlexLayout({
      direction: 'column',
      children: [
        combinedFrame
          ? new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries()
                .setData(
                  new SceneDataNode({
                    data: {
                      series: [combinedFrame],
                      state: LoadingState.Done,
                      timeRange: timeRange,
                    },
                  })
                )
                .setTitle('$metric')
                .build(),
            })
          : //@todo undefined dataframe state
            new SceneFlexItem({
              body: undefined,
              $data: undefined,
            }),
      ],
    });

    this.setState({
      body: new LayoutSwitcher({
        options: [
          { value: 'grid', label: 'Grid' },
          { value: 'rows', label: 'Rows' },
          { value: 'single', label: 'Single' },
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
          singleView,
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
    const logsByServiceScene = sceneGraph.getAncestor(model, LogsByServiceScene);
    const { patterns } = logsByServiceScene.useState();
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          {!loading && !patterns && (
            <div className={styles.patternMissingText}>
              <Text textAlignment="center" color="primary">
                <p>There are no pattern matches.</p>
                <p>Pattern matching has not been configured.</p>
                <p>Patterns let you detect similar log lines and add or exclude them from your search.</p>
                <p>To see them in action, add the following to your configuration</p>
                <p>
                  <code>--pattern-ingester.enabled=true</code>
                </p>
              </Text>
            </div>
          )}
          {!loading && patterns?.length === 0 && <GrotError />}
          {!loading && patterns && patterns.length > 0 && (
            <>
              <div className={styles.controls}>
                {body instanceof LayoutSwitcher && (
                  <div className={styles.controlsRight}>
                    <body.Selector model={body} />
                  </div>
                )}
              </div>
              <div className={styles.content}>{body && <body.Component model={body} />}</div>
            </>
          )}
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
    patternMissingText: css({
      padding: theme.spacing(2),
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
      <Button variant="secondary" size="sm" fill="text" onClick={model.onClick}>
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
