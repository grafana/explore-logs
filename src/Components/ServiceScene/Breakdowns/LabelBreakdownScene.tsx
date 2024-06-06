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
  SceneReactObject,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Button, DrawStyle, Field, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { DetectedLabel, DetectedLabelsResponse, getLabelValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { PLUGIN_ID } from 'services/routing';
import { getLabelOptions, getLokiDatasource } from 'services/scenes';
import { ALL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR, VAR_FILTERS, VAR_LABEL_GROUP_BY } from 'services/variables';
import { AddToFiltersButton } from './AddToFiltersButton';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: boolean;
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
      loading: true,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
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
    const ds = await getLokiDatasource(this);

    if (!ds) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;
    let detectedLabels: DetectedLabel[] | undefined = undefined;

    try {
      const response = await ds.getResource<DetectedLabelsResponse>(
        'detected_labels',
        {
          query: filters.state.filterExpression,
          start: timeRange.from.utc().toISOString(),
          end: timeRange.to.utc().toISOString(),
        },
        {
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      detectedLabels = response?.detectedLabels;
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, error: true });
    }

    if (!detectedLabels || !Array.isArray(detectedLabels)) {
      this.setState({ loading: false, error: true });
      return;
    }

    const labels = detectedLabels
      .filter((a) => a.cardinality > 1)
      .sort((a, b) => a.cardinality - b.cardinality)
      .map((l) => l.label);
    const options = getLabelOptions(this, labels);

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      value: String(variable.state.value),
      labels: options, // this now includes "all"
      blockingMessage: undefined,
      error: false,
    };

    stateUpdate.body = variable.hasAllValue() ? buildLabelsLayout(options) : buildLabelValuesLayout(variable);

    this.setState(stateUpdate);
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        label: value,
        previousLabel: variable.getValueText(),
        view: 'labels',
      }
    );

    variable.changeValueTo(value);
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { labels, body, loading, value, blockingMessage, error } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && labels.length > 0 && (
              <div className={styles.controlsLeft}>
                <Field label="By label">
                  <FieldSelector options={labels} value={value} onChange={model.onChange} />
                </Field>
              </div>
            )}
            {error && (
              <Alert title="" severity="warning">
                The labels are not available at this moment. Try using a different time range or check again later.
              </Alert>
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

function buildLabelsLayout(options: Array<SelectableValue<string>>) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    const { value: optionValue } = option;
    if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
      continue;
    }

    children.push(
      new SceneCSSGridItem({
        body: PanelBuilders.timeseries()
          .setTitle(optionValue)
          .setData(getQueryRunner(buildLokiQuery(getExpr(optionValue), { legendFormat: `{{${optionValue}}}` })))
          .setHeaderActions(new SelectLabelAction({ labelName: String(optionValue) }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .setOverrides(setLeverColorOverrides)
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
    actionView: 'labels',
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
  });
}

function getExpr(tagKey: string) {
  return `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${tagKey}!="" [$__auto])) by (${tagKey})`;
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildLabelValuesLayout(variable: CustomVariable) {
  const tagKey = variable.getValueText();
  const query = buildLokiQuery(getExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

  let bodyOpts = PanelBuilders.timeseries();
  bodyOpts = bodyOpts
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setOverrides(setLeverColorOverrides)
    .setTitle(variable.getValueText());

  const body = bodyOpts.build();

  return new LayoutSwitcher({
    $data: getQueryRunner(query),
    options: [
      { value: 'single', label: 'Single' },
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    actionView: 'labels',
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
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild: getLabelValueScene(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line
        ),
      }),
      new ByFrameRepeater({
        body: new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: [
            new SceneFlexItem({
              body: new SceneReactObject({
                reactNode: <LoadingPlaceholder text="Loading..." />,
              }),
            }),
          ],
        }),
        getLayoutChild: getLabelValueScene(
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

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
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
