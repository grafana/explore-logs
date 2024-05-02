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
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Button, DrawStyle, StackingMode, useStyles2, Text, TextLink } from '@grafana/ui';
import { AddToFiltersGraphAction } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { LayoutSwitcher } from 'Components/ServiceScene/Breakdowns/LayoutSwitcher';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { GrotError } from 'Components/GrotError';
import { VAR_LABEL_GROUP_BY } from 'services/variables';
import { getColorByIndex } from 'services/scenes';
import { ServiceScene } from '../ServiceScene';
import { FilterByPatternsButton } from './FilterByPatternsButton';
export interface PatternsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
}

type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
};

export class PatternsBreakdownScene extends SceneObjectBase<PatternsBreakdownSceneState> {
  constructor(state: Partial<PatternsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      loading: true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    this.updateBody();
    const unsub = sceneGraph.getAncestor(this, ServiceScene).subscribeToState((newState, prevState) => {
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

    const patterns = sceneGraph.getAncestor(this, ServiceScene).state.patterns;
    if (!patterns) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    let maxValue = -Infinity;
    let minValue = 0;

    const frames: PatternFrame[] = patterns
      .map((pat, frameIndex) => {
        const timeValues: number[] = [];
        const sampleValues: number[] = [];
        let sum = 0;
        pat.samples.forEach(([time, value]) => {
          timeValues.push(time * 1000);
          const sample = parseFloat(value);
          sampleValues.push(sample);
          if (sample > maxValue) {
            maxValue = sample;
          }
          if (sample < minValue) {
            minValue = sample;
          }
          sum += sample;
        });
        const dataFrame: DataFrame = {
          refId: pat.pattern,
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: timeValues,
              config: {},
            },
            {
              name: pat.pattern,
              type: FieldType.number,
              values: sampleValues,
              config: {},
            },
          ],
          length: pat.samples.length,
          meta: {
            preferredVisualisationType: 'graph',
          },
        };

        return {
          dataFrame,
          pattern: pat.pattern,
          sum,
        };
      })
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 20);

    for (let i = 0; i < frames.length; i++) {
      const { dataFrame, pattern, sum } = frames[i];
      children.push(
        new SceneCSSGridItem({
          body: PanelBuilders.timeseries()
            .setTitle(`${pattern}`)
            .setDescription(`The pattern \`${pattern}\` has been matched \`${sum}\` times in the given timerange.`)
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
            .setColor({ mode: 'fixed', fixedColor: getColorByIndex(i) })
            .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
            .setCustomFieldConfig('fillOpacity', 100)
            .setCustomFieldConfig('lineWidth', 0)
            .setCustomFieldConfig('pointSize', 0)
            .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
            .setCustomFieldConfig('axisSoftMax', maxValue)
            .setCustomFieldConfig('axisSoftMin', minValue)
            .setHeaderActions([
              new FilterByPatternsButton({ pattern: pattern, type: 'exclude' }),
              new FilterByPatternsButton({ pattern: pattern, type: 'include' }),
            ])
            .build(),
        })
      );
    }

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
            children: children.map((child) => child.clone()),
          }),
        ],
      }),
      loading: false,
    });
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<PatternsBreakdownScene>) => {
    const { body, loading, blockingMessage } = model.useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
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
          {!loading && patterns?.length === 0 && (
            <GrotError>
              <div>
                Sorry, we could not detect any patterns.
                <p>
                  Check back later or reachout to the{' '}
                  <TextLink href="https://slack.grafana.com/" external>
                    Grafana Labs community Slack channel
                  </TextLink>
                </p>
                Patterns let you detect similar log lines and add or exclude them from your search.
              </div>
            </GrotError>
          )}
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
    body: new PatternsBreakdownScene({}),
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

function getPatternsSceneFor(model: SceneObject): PatternsBreakdownScene {
  if (model instanceof PatternsBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getPatternsSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
