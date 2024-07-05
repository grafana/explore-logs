import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
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
import { Alert, Button, DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getFilterBreakdownValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery, renderLogQLStreamSelector } from 'services/query';
import { getSortByPreference } from 'services/store';
import {
  ALL_VARIABLE_VALUE,
  LOG_EXPR_WITHOUT_STREAM_SELECTOR,
  VAR_FIELDS,
  VAR_FIELD_GROUP_BY,
  VAR_LABELS,
} from 'services/variables';
import { ServiceScene } from '../ServiceScene';
import { BreakdownSearchScene, getLabelValue } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { StatusWrapper } from './StatusWrapper';
import { DetectedField } from 'models/DetectedField';
export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  search: BreakdownSearchScene;
  sort: SortByScene;
  fields: Array<SelectableValue<DetectedField>>;

  fieldLabel?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;

  changeFields?: (n: DetectedField[]) => void;
}

export class FieldsBreakdownScene extends SceneObjectBase<FieldsBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<FieldsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_FIELD_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      loading: true,
      sort: new SortByScene({ target: 'fields' }),
      search: new BreakdownSearchScene(),
      ...state,
      fields: state.fields ?? [],
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const variable = this.getVariable();

    this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange);

    sceneGraph.getAncestor(this, ServiceScene)!.subscribeToState((newState, oldState) => {
      if (newState.fields !== oldState.fields) {
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

    this.updateFields();
    this.updateBody();
  }

  private updateFields() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    this.setState({
      fields: [
        { label: 'All', value: DetectedField.All },
        ...(serviceScene.state.fields ?? []).map((f) => ({
          label: f.label,
          value: f,
        })),
      ],
      loading: serviceScene.state.loading,
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

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(DetectedField.All.label);
    this.updateBody();
  }

  private hideFieldByLabel(field: string) {
    // TODO: store in localstorage that this field was hidden?
    const fields = this.state.fields.filter((f) => f.value?.label !== field);
    this.setState({ fields });

    this.state.changeFields?.(fields.filter((f) => f.value?.type !== ALL_VARIABLE_VALUE).map((f) => f.value!));
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (this.state.body instanceof LayoutSwitcher && this.state.body.state.layouts[1] instanceof ByFrameRepeater) {
      this.state.body.state.layouts[1].sort(event.sortBy, event.direction);
    }
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.value_breakdown_sort_change,
      {
        target: 'fields',
        criteria: event.sortBy,
        direction: event.direction,
      }
    );
  };

  private updateBody() {
    const fieldLabelVariable = this.getVariable();
    const labelVariable = sceneGraph.lookupVariable(VAR_LABELS, this);
    if (!(labelVariable instanceof AdHocFiltersVariable)) {
      return;
    }
    const streamSelector = renderLogQLStreamSelector(labelVariable.state.filters);
    const detectedField = getFieldByLabel(this.state.fields, fieldLabelVariable.getValueText());

    const stateUpdate: Partial<FieldsBreakdownSceneState> = {
      fieldLabel: fieldLabelVariable.getValueText(),
      blockingMessage: undefined,
    };

    if (this.state.loading === false && this.state.fields.length === 1) {
      stateUpdate.body = this.buildEmptyLayout();
    } else {
      stateUpdate.body =
        fieldLabelVariable.hasAllValue() || !detectedField || detectedField.type === ALL_VARIABLE_VALUE
          ? this.buildFieldsLayout(this.state.fields, streamSelector)
          : buildValuesLayout(detectedField, streamSelector);
    }

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
                  We did not find any fields for the given timerange. Please{' '}
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

  private buildFieldsLayout(detectedFields: Array<SelectableValue<DetectedField>>, streamSelector: string) {
    const children: SceneFlexItemLike[] = [];

    for (const option of detectedFields) {
      const { value: detectedField } = option;
      if (detectedField?.type === ALL_VARIABLE_VALUE || !detectedField) {
        continue;
      }

      const query = buildLokiQuery(getExpr(detectedField, streamSelector), {
        legendFormat: `{{${detectedField.label}}}`,
        refId: detectedField.label,
      });
      const queryRunner = getQueryRunner(query);
      let body = PanelBuilders.timeseries().setTitle(detectedField.label).setData(queryRunner);

      if (!isAvgFieldType(detectedField.type)) {
        body = body
          .setHeaderActions(new SelectLabelAction({ field: detectedField }))
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
          this.hideFieldByLabel(val);
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

  public onFieldSelectorChange = (detectedField?: DetectedField) => {
    if (!detectedField) {
      return;
    }

    const fieldLabelVariable = this.getVariable();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        field: detectedField.label,
        previousField: fieldLabelVariable.getValueText(),
        view: 'fields',
      }
    );

    fieldLabelVariable.changeValueTo(detectedField.label);
  };

  public static Component = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { fields, body, loading, fieldLabel, blockingMessage, search, sort } = model.useState();
    const styles = useStyles2(getStyles);
    const detectedField = fieldLabel ? getFieldByLabel(fields, fieldLabel) : undefined;

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {body instanceof LayoutSwitcher && <body.Selector model={body} />}
            {!loading && detectedField?.type !== ALL_VARIABLE_VALUE && (
              <>
                <sort.Component model={sort} />
                <search.Component model={search} />
              </>
            )}
            {!loading && fields.length > 1 && (
              <FieldSelector<DetectedField>
                label="Field"
                options={fields}
                value={detectedField}
                onChange={model.onFieldSelectorChange}
              />
            )}
          </div>
          <div className={styles.content}>{body && <body.Component model={body} />}</div>
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

function getFieldByLabel(fields: Array<SelectableValue<DetectedField>>, fieldLabel: string) {
  return fields.find((f) => f?.label === fieldLabel)?.value;
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
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
      gap: theme.spacing(2),
    }),
  };
}

function isAvgFieldType(fieldType: string) {
  return ['duration', 'bytes'].includes(fieldType);
}

function getExpr(field: DetectedField, streamSelector: string) {
  if (isAvgFieldType(field.type)) {
    return `avg_over_time(${streamSelector} ${LOG_EXPR_WITHOUT_STREAM_SELECTOR} | ${field.parsers[0]} | ${field.label}!="" | unwrap ${field.type}(${field.label}) [$__auto]) by ()`;
  }
  return `sum by (${field.label}) (count_over_time(${streamSelector} ${LOG_EXPR_WITHOUT_STREAM_SELECTOR} | ${field.parsers[0]} | drop __error__ | ${field.label}!="" [$__auto]))`;
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildValuesLayout(field: DetectedField, streamSelector: string) {
  const query = buildLokiQuery(getExpr(field, streamSelector), { legendFormat: `{{${field.label}}}` });

  const { sortBy, direction } = getSortByPreference('fields', ReducerID.stdDev, 'desc');

  return new LayoutSwitcher({
    $data: getQueryRunner(query),
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
            body: PanelBuilders.timeseries().setTitle(field.label).build(),
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
        sortBy,
        direction,
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
        sortBy,
        direction,
      }),
    ],
  });
}

export function buildFieldsBreakdownActionScene(changeFieldNumber: (n: DetectedField[]) => void) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ changeFields: changeFieldNumber }),
      }),
    ],
  });
}

interface SelectLabelActionState extends SceneObjectState {
  field: DetectedField;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getFieldsBreakdownSceneFor(this).onFieldSelectorChange(this.state.field);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={model.onClick}
        aria-label={`Select ${model.useState().field.label}`}
      >
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
