import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, SelectableValue } from '@grafana/data';
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
import { Button, DrawStyle, Field, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getLabelValueScene } from 'services/fields';
import { getQueryRunner, levelOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { getUniqueFilters } from 'services/scenes';
import { ALL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR, VAR_FIELD_GROUP_BY, VAR_FILTERS } from 'services/variables';
import { ServiceScene } from '../ServiceScene';
import { AddToFiltersButton } from './AddToFiltersButton';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  fields: Array<SelectableValue<string>>;

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
          variables: [new CustomVariable({ name: VAR_FIELD_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      fields: state.fields ?? [],
      loading: true,
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    const variable = this.getVariable();

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
        this.updateBody(variable);
      }
    });

    this.updateFields();
    this.updateBody(variable);
  }

  private updateFields() {
    const variable = this.getVariable();
    const logsScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      fields: [
        { label: 'All', value: ALL_VARIABLE_VALUE },
        ...getUniqueFilters(logsScene, logsScene.state.detectedFields || []).map((f) => ({
          label: f,
          value: f,
        })),
      ],
    });

    this.updateBody(variable);
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUP_BY, this)!;
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

  private hideField(field: string) {
    // TODO: store in localstorage that this field was hidden?
    const fields = this.state.fields.filter((f) => f.value !== field);
    this.setState({ fields });

    this.state.changeFields?.(fields.filter((f) => f.value !== ALL_VARIABLE_VALUE).map((f) => f.value!));
  }

  private async updateBody(variable: CustomVariable) {
    const stateUpdate: Partial<FieldsBreakdownSceneState> = {
      loading: false,
      value: String(variable.state.value),
      blockingMessage: undefined,
    };

    stateUpdate.body = variable.hasAllValue() ? this.buildAllLayout(this.state.fields) : buildNormalLayout(variable);

    this.setState(stateUpdate);
  }

  private buildAllLayout(options: Array<SelectableValue<string>>) {
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
          .setOverrides(levelOverrides);
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

  public onChange = (value?: string) => {
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

  public static Component = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { fields, body, loading, value, blockingMessage } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {!loading && fields.length > 0 && (
              <div className={styles.controlsLeft}>
                <Field label="By field">
                  <FieldSelector options={fields} value={value} onChange={model.onChange} />
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

const avgFields = ['duration', 'count', 'total', 'bytes'];

function isAvgField(field: string) {
  return avgFields.includes(field);
}

function getExpr(field: string) {
  if (isAvgField(field)) {
    return (
      `avg_over_time(${LOG_STREAM_SELECTOR_EXPR} | unwrap ` +
      (field === 'duration' ? `duration` : field === 'bytes' ? `bytes` : ``) +
      `(${field}) [$__auto]) by ()`
    );
  }
  return `sum by (${field}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${field}!=""   [$__auto]))`;
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildNormalLayout(variable: CustomVariable) {
  const tagKey = variable.getValueText();
  const query = buildLokiQuery(getExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

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
          isLazy: true,
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

export function buildFieldsBreakdownActionScene(changeFieldNumber: (n: string[]) => void) {
  return new SceneFlexItem({
    body: new FieldsBreakdownScene({ changeFields: changeFieldNumber }),
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getFieldsBreakdownSceneFor(this).onChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
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
