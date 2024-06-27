import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import {
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
import { Alert, Button, DrawStyle, IconButton, LoadingPlaceholder, Stack, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getFilterBreakdownValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import {
  ALL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FIELD_AGGREGATE_BY,
  VAR_FIELD_GROUP_BY,
  VAR_FIELD_GROUPBY_BY,
  VAR_FIELDS,
  VAR_FILTERS,
} from 'services/variables';
import { ServiceScene } from '../ServiceScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';
import { BreakdownSearchScene, getLabelValue } from './BreakdownSearchScene';
import { AggregationTypes, BreakdownAggrSelector } from './BreakdownAggrSelectorScene';
import { BreakdownAggrBySelector } from './BreakdownAggrBySelectorScene';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  search?: BreakdownSearchScene;
  fields: Array<SelectableValue<string>>;

  aggregationValue?: string;
  byValue?: string[];
  byOptions: Array<{ value: string; label: string }>;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;

  changeFields?: (n: string[]) => void;
}

export class FieldsBreakdownScene extends SceneObjectBase<FieldsBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<FieldsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new CustomVariable({ name: VAR_FIELD_GROUP_BY, defaultToAll: true, includeAll: true }),
            new CustomVariable({ name: VAR_FIELD_AGGREGATE_BY, defaultToAll: true, includeAll: true }),
            new CustomVariable({ name: VAR_FIELD_GROUPBY_BY, value: [], includeAll: false, isMulti: true }),
          ],
        }),
      fields: state.fields ?? [],
      loading: true,
      byOptions: [],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const variable = this.getVariable();
    const aggregate = this.getAggregateVariable();
    const by = this.getByVariable();
    sceneGraph.getAncestor(this, ServiceScene)!.subscribeToState((newState, oldState) => {
      if (newState.detectedFields !== oldState.detectedFields) {
        this.updateFields();
      }
    });

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody();
      }
    });
    aggregate.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody();
      }
    });
    by.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody();
      }
    });

    this.updateFields();
    this.updateBody();
  }

  private updateFields() {
    const logsScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      fields: [
        { label: 'All', value: ALL_VARIABLE_VALUE },
        ...(logsScene.state.detectedFields ?? []).map((f) => ({
          label: f,
          value: f,
        })),
      ],
      loading: logsScene.state.loading,
      byOptions: [
        ...(logsScene.state.labels?.map((label) => ({ value: label, label: label })) ?? []),
        ...(logsScene.state.detectedFields ?? []).map((f) => ({ value: f ?? '', label: f ?? '' })),
      ]
        .filter((f) => f.value !== ALL_VARIABLE_VALUE && f.value !== '')
        .reduce((acc, current) => {
          if (!acc.find((item) => item.label === current.label)) {
            acc.push(current);
          }
          return acc;
        }, [] as Array<{ value: string; label: string }>)
        .sort((a, b) => a.label.localeCompare(b.label)),
    });

    this.updateBody();
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private getAggregateVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_FIELD_AGGREGATE_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private getByVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUPBY_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody();
  }

  private hideField(field: string) {
    // TODO: store in localstorage that this field was hidden?
    const fields = this.state.fields.filter((f) => f.value !== field);
    this.setState({ fields });

    this.state.changeFields?.(fields.filter((f) => f.value !== ALL_VARIABLE_VALUE).map((f) => f.value!));
  }

  private updateBody() {
    console.log('updating body');
    const variable = this.getVariable();
    const aggregate = this.getAggregateVariable();
    const by = this.getByVariable();
    console.log(by.state.value);
    const stateUpdate: Partial<FieldsBreakdownSceneState> = {
      value: String(variable.state.value),
      aggregationValue: String(aggregate.state.value),
      byValue: (by.state.value ?? []) as string[],
      blockingMessage: undefined,
    };

    if (this.state.loading === false && this.state.fields.length === 1) {
      stateUpdate.body = this.buildEmptyLayout();
    } else {
      stateUpdate.body = variable.hasAllValue()
        ? this.buildFieldsLayout(this.state.fields)
        : buildValuesLayout(variable, stateUpdate.aggregationValue, stateUpdate.byValue ?? []);
    }

    stateUpdate.search = new BreakdownSearchScene();

    this.setState(stateUpdate);
  }

  private buildEmptyLayout() {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({
            reactNode: (
              <div>
                <Alert title="" severity="warning">
                  No detected fields. Please{' '}
                  <a
                    className={emptyStateStyles.link}
                    href="https://forms.gle/1sYWCTPvD72T1dPH9"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    let us know
                  </a>{' '}
                  if you think this is a mistake.
                </Alert>
              </div>
            ),
          }),
        }),
      ],
    });
  }

  private buildFieldsLayout(options: Array<SelectableValue<string>>) {
    const children: SceneFlexItemLike[] = [];

    for (const option of options) {
      const { value: optionValue } = option;
      if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
        continue;
      }

      const query = buildLokiQuery(getExpr(optionValue), {
        legendFormat: `{{${optionValue}}}`,
        refId: optionValue,
      });
      const queryRunner = getQueryRunner(query);
      let body = PanelBuilders.timeseries().setTitle(optionValue).setData(queryRunner);

      if (!isAvgField(optionValue)) {
        body = body
          .setHeaderActions(new SelectLabelAction({ labelName: String(optionValue) }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .setOverrides(setLeverColorOverrides);
      }
      const gridItem = new SceneCSSGridItem({
        body: body.build(),
      });

      queryRunner.getResultsStream().subscribe((result) => {
        if (result.data.errors && result.data.errors.length > 0) {
          const val = result.data.errors[0].refId!;
          this.hideField(val);
          gridItem.setState({ isHidden: true });
        }
      });

      children.push(gridItem);
    }

    return new LayoutSwitcher({
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      actionView: 'fields',
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
    });
  }

  public onFieldSelectorChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        field: value,
        previousField: variable.getValueText(),
        view: 'fields',
      }
    );

    variable.changeValueTo(value);
  };

  public onAggregationSelectorChange = (value: SelectableValue<string>) => {
    if (!value) {
      return;
    }

    const variable = this.getAggregateVariable();
    // reportAppInteraction(
    //   USER_EVENTS_PAGES.service_details,
    //   USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
    //   {
    //     field: value,
    //     previousField: variable.getValueText(),
    //     view: 'fields',
    //   }
    // );

    variable.changeValueTo(value.value ?? '');
  };

  public onBySelectorChange = (value: string[]) => {
    const variable = this.getByVariable();
    // reportAppInteraction(
    //   USER_EVENTS_PAGES.service_details,
    //   USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
    //   {
    //     field: value,
    //     previousField: variable.getValueText(),
    //     view: 'fields',
    //   }
    // );
    // Log the type of `value`
    variable.changeValueTo(value ?? []);
  };

  public static Component = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { fields, body, loading, value, blockingMessage, search, aggregationValue, byValue, byOptions } =
      model.useState();
    const styles = useStyles2(getStyles);
    const [isMetricsVisible, setIsMetricsVisible] = useState(false);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <Stack direction={'column'} gap={2}>
            <Stack>
              {value !== ALL_VARIABLE_VALUE && (
                <IconButton
                  name="graph-bar"
                  aria-label="More aggregations"
                  tooltip="Discover more aggregations for this field"
                  tooltipPlacement="top-end"
                  onClick={() => setIsMetricsVisible(!isMetricsVisible)}
                />
              )}
              {!loading && fields.length > 1 && (
                <FieldSelector label="Field" options={fields} value={value} onChange={model.onFieldSelectorChange} />
              )}
              {!loading && value !== ALL_VARIABLE_VALUE && search instanceof BreakdownSearchScene && (
                <search.Component model={search} />
              )}
              {body instanceof LayoutSwitcher && <body.Selector model={body} className={styles.gridControls} />}
            </Stack>
            {isMetricsVisible && (
              <Stack alignItems={'center'}>
                {!loading && value !== ALL_VARIABLE_VALUE && (
                  <>
                    <div style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }}>
                      <span>└</span>
                    </div>
                    <div style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }}>
                      <BreakdownAggrSelector
                        aggregation={aggregationValue}
                        onAggregationChange={model.onAggregationSelectorChange}
                      />
                    </div>
                  </>
                )}
                {!loading && value !== ALL_VARIABLE_VALUE && (
                  <>
                    <div style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }}>
                      <span> by </span>
                    </div>
                    <div style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto' }}>
                      <BreakdownAggrBySelector by={byValue} onChange={model.onBySelectorChange} options={byOptions} />
                    </div>
                  </>
                )}
              </Stack>
            )}
            <Stack>
              <div className={styles.content}>{body && <body.Component model={body} />}</div>
            </Stack>
          </Stack>
        </StatusWrapper>
      </div>
    );
  };
}

const emptyStateStyles = {
  link: css({
    textDecoration: 'underline',
  }),
};

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
    gridControls: css({
      marginBottom: 0,
    }),
    queryControls: css({
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: 'auto',
    }),
  };
}

const avgFields = ['duration', 'count', 'total', 'bytes'];

function isAvgField(field: string) {
  return avgFields.includes(field);
}

function getExpr(field: string) {
  if (isAvgField(field)) {
    return `avg_over_time(${LOG_STREAM_SELECTOR_EXPR} | unwrap  ${unwrapField(field)} [$__auto]) by ()`;
  }
  return `sum by (${field}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${field}!=""   [$__auto]))`;
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function getFieldExpr(field: string, aggregation: string | undefined, by: string[]): string {
  if (!aggregation) {
    return '';
  }
  switch (aggregation ?? '') {
    case AggregationTypes.count.value:
      return `sum by (${[field, ...by].join(
        `,`
      )}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${field}!="" [$__auto]))`;
    case AggregationTypes.sum.value:
      return `sum by (${by.join(`,`)}) (${aggregation}(${LOG_STREAM_SELECTOR_EXPR} | unwrap  ${unwrapField(
        field
      )} [$__auto]))`;
    case AggregationTypes.avg.value:
    case AggregationTypes.min.value:
    case AggregationTypes.max.value:
      return `${aggregation}(${LOG_STREAM_SELECTOR_EXPR} | unwrap  ${unwrapField(field)} [$__auto]) by (${by.join(
        `,`
      )})`;
    case AggregationTypes.rate.value:
      return `sum by (${by.join(`,`)}) (${aggregation}(${LOG_STREAM_SELECTOR_EXPR} | unwrap  ${unwrapField(
        field
      )} [$__auto])) `;
    case AggregationTypes.p50.value:
    case AggregationTypes.p75.value:
    case AggregationTypes.p90.value:
      return `quantile_over_time(${aggregation}, ${LOG_STREAM_SELECTOR_EXPR} | unwrap ${unwrapField(
        field
      )} [$__auto]) by (${by.join(`,`)})`;
  }
  return ``;
}

function unwrapField(field: string): string {
  if (field.includes('duration')) {
    return `duration(${field})`;
  }

  if (field.includes('bytes')) {
    return `bytes(${field})`;
  }
  return `${field}`;
}

function buildValuesLayout(variable: CustomVariable, aggregation: string | undefined, by: string[]) {
  const tagKey = variable.getValueText();
  const expr = getFieldExpr(tagKey, aggregation, by);
  console.log(expr);
  console.log(by);
  const query = buildLokiQuery(expr, { legendFormat: `{{${tagKey}}}` });
  console.log(query);

  return new LayoutSwitcher({
    $data: getQueryRunner(query),
    actionView: 'fields',
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
            body: PanelBuilders.timeseries().setTitle(variable.getValueText()).build(),
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
          isLazy: true,
        }),
        getLayoutChild: getFilterBreakdownValueScene(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
          VAR_FIELDS
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
          isLazy: true,
        }),
        getLayoutChild: getFilterBreakdownValueScene(
          getLabelValue,
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
          VAR_FIELDS
        ),
      }),
    ],
  });
}

export function buildFieldsBreakdownActionScene(changeFieldNumber: (n: string[]) => void) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ changeFields: changeFieldNumber }),
      }),
    ],
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getFieldsBreakdownSceneFor(this).onFieldSelectorChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Select
      </Button>
    );
  };
}

function getFieldsBreakdownSceneFor(model: SceneObject): FieldsBreakdownScene {
  if (model instanceof FieldsBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getFieldsBreakdownSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
