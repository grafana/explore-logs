import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Button, DrawStyle, Field, StackingMode, useStyles2 } from '@grafana/ui';

import { BreakdownLabelSelector } from './BreakdownLabelSelector';
import { StatusWrapper } from '../../StatusWrapper';
import {
  ALL_VARIABLE_VALUE,
  explorationDS,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FILTERS,
  VAR_LABEL_GROUP_BY,
} from '../../../../utils/shared';

import { AddToFiltersGraphAction } from '../../AddToFiltersGraphAction';
import { ByFrameRepeater } from '../../ByFrameRepeater';
import { LayoutSwitcher } from '../../LayoutSwitcher';
import { getDatasource, getLabelOptions } from '../../../../utils/utils';
import { getLayoutChild } from '../../../../utils/fields';
import { DetectedLabelsResponse } from 'components/Explore/types';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<LabelBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      labels: state.labels ?? [],
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    const variable = this.getVariable();

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody(variable);
      }
    });

    this.updateBody(variable);
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody(variable);
  }

  private async updateBody(variable: CustomVariable) {
    const ds = await getDatasource(this);

    if (!ds) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;

    const { detectedLabels } = await ds.getResource<DetectedLabelsResponse>('detected_labels', {
      query: filters.state.filterExpression,
      from: timeRange.from.utc().toISOString(),
      to: timeRange.to.utc().toISOString(),
    });

    const labels = detectedLabels.map((l) => l.label);
    const options = getLabelOptions(this, labels);

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      value: String(variable.state.value),
      labels: options,
      blockingMessage: undefined,
    };

    stateUpdate.body = variable.hasAllValue() ? buildAllLayout(options) : buildNormalLayout(variable);

    this.setState(stateUpdate);
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { labels, body, loading, value, blockingMessage } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && labels.length > 0 && (
              <div className={styles.controlsLeft}>
                <Field label="By label">
                  <BreakdownLabelSelector options={labels} value={value} onChange={model.onChange} />
                </Field>
              </div>
            )}
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

export function buildAllLayout(options: Array<SelectableValue<string>>) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    if (option.value === ALL_VARIABLE_VALUE) {
      continue;
    }

    children.push(
      new SceneCSSGridItem({
        body: PanelBuilders.timeseries()
          .setTitle(option.label!)
          .setData(
            new SceneQueryRunner({
              maxDataPoints: 300,
              datasource: explorationDS,
              queries: [
                {
                  refId: 'A',
                  expr: getExpr(option.value!),
                  legendFormat: `{{${option.label}}}`,
                },
              ],
            })
          )
          .setHeaderActions(new SelectLabelAction({ labelName: String(option.value) }))
          .setHeaderActions(new SelectLabelAction({ labelName: String(option.value) }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .build(),
      })
    );
  }

  return new LayoutSwitcher({
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
        children: children.map(child => child.clone()),
      }),
    ],
  });
}

function getExpr(tagKey: string) {
  return `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ [$__auto])) by (${tagKey})`;
}

function buildQuery(tagKey: string) {
  return {
    refId: 'A',
    expr: getExpr(tagKey),
    queryType: 'range',
    editorMode: 'code',
    maxLines: 1000,
    intervalMs: 2000,
  };
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(variable: CustomVariable) {
  const query = buildQuery(variable.getValueText());

  let bodyOpts = PanelBuilders.timeseries();
  bodyOpts = bodyOpts
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setTitle('$metric');

  const body = bodyOpts.build();

  return new LayoutSwitcher({
    $data: new SceneQueryRunner({
      datasource: explorationDS,
      maxDataPoints: 300,
      queries: [query],
    }),
    options: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    layouts: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            minHeight: 300,
            body,
          }),
        ],
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild: getLayoutChild(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line
        ),
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [],
        }),
        getLayoutChild: getLayoutChild(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line
        ),
      }),
    ],
  });
}

function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return 'No labels';
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return 'No labels';
  }

  return labels[keys[0]];
}

export function buildLabelBreakdownActionScene() {
  return new SceneFlexItem({
    body: new LabelBreakdownScene({}),
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getBreakdownSceneFor(this).onChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersGraphAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}

function getBreakdownSceneFor(model: SceneObject): LabelBreakdownScene {
  if (model instanceof LabelBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getBreakdownSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
