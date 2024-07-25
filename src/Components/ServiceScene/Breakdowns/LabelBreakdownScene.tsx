import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ReducerID } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { Alert, Button, DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { DetectedLabel, getFilterBreakdownValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { ValueSlugs } from 'services/routing';
import { getLokiDatasource, isDefined } from 'services/scenes';
import {
  ALL_VARIABLE_VALUE,
  VAR_LABEL_GROUP_BY,
  VAR_LABELS,
  VAR_FIELDS_EXPR,
  VAR_LINE_FILTER_EXPR,
  VAR_PATTERNS_EXPR,
  LEVEL_VARIABLE_VALUE,
  VAR_LOGS_FORMAT_EXPR,
  getLabelGroupByVariable,
  getLabelsVariable,
  getFieldsVariable,
} from 'services/variables';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';
import { getLabelOptions, sortLabelsByCardinality } from 'services/filters';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { getSortByPreference } from 'services/store';
import { getLabelValue, SortByScene, SortCriteriaChanged } from './SortByScene';
import { ServiceScene, ServiceSceneState } from '../ServiceScene';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { areArraysEqual } from '../../../services/comparison';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  search: BreakdownSearchScene;
  sort: SortByScene;
  loading?: boolean;
  error?: boolean;
  blockingMessage?: string;
  // We have to store the value in state because scenes doesn't allow variables that don't have options. We need to hold on to this until the API call getting values is done, and then reset the state
  value?: string;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
  });

  // Labels/options can be passed in when instantiated, but should ONLY exist on the state of the variable
  constructor(state: Partial<LabelBreakdownSceneState> & { options?: VariableValueOption[]; value?: string }) {
    super({
      ...state,
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new CustomConstantVariable({
              name: VAR_LABEL_GROUP_BY,
              defaultToAll: false,
              includeAll: true,

              value: state.value ?? ALL_VARIABLE_VALUE,
              options: state.options ?? [],
            }),
          ],
        }),
      loading: true,
      sort: new SortByScene({ target: 'labels' }),
      search: new BreakdownSearchScene('labels'),
      value: state.value,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.setState({
      loading: true,
    });

    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));

    const variable = this.getVariable();
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // Need to update labels with current state
    if (serviceScene.state.labels) {
      this.updateLabels(serviceScene.state.labels);
    }

    this._subs.add(serviceScene.subscribeToState(this.onServiceStateChange));
    this._subs.add(variable.subscribeToState(this.onVariableStateChange));
  }

  /**
   * Update body when variable state is updated
   * @param newState
   * @param oldState
   */
  private onVariableStateChange = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
    if (
      !areArraysEqual(newState.options, oldState.options) ||
      newState.value !== oldState.value ||
      newState.loading !== oldState.loading
    ) {
      const variable = this.getVariable();
      this.updateBody(variable, newState);
    }
  };

  /**
   * Pull the detected_labels from our service scene, update the variable when they change
   * @param newState
   * @param prevState
   */
  private onServiceStateChange = (newState: ServiceSceneState, prevState: ServiceSceneState) => {
    const variable = this.getVariable();
    if (!areArraysEqual(newState.labels, prevState.labels)) {
      this.updateLabels(newState.labels);
    } else if (newState.labels?.length && !variable.state.options.length) {
      this.updateLabels(newState.labels);
    }
  };

  private getVariable(): CustomConstantVariable {
    return getLabelGroupByVariable(this);
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }
    if (this.state.body instanceof LayoutSwitcher) {
      this.state.body.state.layouts.forEach((layout) => {
        if (layout instanceof ByFrameRepeater) {
          layout.sort(event.sortBy, event.direction);
        }
      });
    }
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.value_breakdown_sort_change,
      {
        target: 'labels',
        criteria: event.sortBy,
        direction: event.direction,
      }
    );
  };

  private updateLabels(detectedLabels: DetectedLabel[] | undefined) {
    if (!detectedLabels || !detectedLabels.length) {
      return;
    }
    const variable = this.getVariable();
    const labels = detectedLabels.sort((a, b) => sortLabelsByCardinality(a, b)).map((l) => l.label);
    const options = getLabelOptions(labels);

    variable.setState({
      options,
      value: this.state.value ?? ALL_VARIABLE_VALUE,
    });
  }

  private async updateBody(variable: CustomConstantVariable, variableState: CustomConstantVariableState) {
    const ds = await getLokiDatasource(this);

    if (!ds) {
      return;
    }

    // We get the labels from the service scene, if we don't have them yet, assume we're loading
    if (!variableState.options || !variableState.options.length) {
      return;
    }

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      blockingMessage: undefined,
      error: false,
    };

    stateUpdate.body = variable.hasAllValue()
      ? this.buildLabelsLayout(variableState.options)
      : this.buildLabelValuesLayout(variableState);

    this.setState(stateUpdate);
  }

  private buildLabelsLayout(options: VariableValueOption[]) {
    this.state.search.reset();
    const children: SceneFlexItemLike[] = [];

    for (const option of options) {
      const { value } = option;
      const optionValue = String(value);
      if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
        continue;
      }

      children.push(
        new SceneCSSGridItem({
          body: PanelBuilders.timeseries()
            .setTitle(optionValue)
            .setData(getQueryRunner(buildLokiQuery(this.getExpr(optionValue), { legendFormat: `{{${optionValue}}}` })))
            .setHeaderActions(new SelectLabelAction({ labelName: optionValue }))
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
      layouts: [
        new SceneCSSGridLayout({
          isLazy: true,
          templateColumns: GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: children,
        }),
        new SceneCSSGridLayout({
          isLazy: true,
          templateColumns: '1fr',
          autoRows: '200px',
          children: children.map((child) => child.clone()),
        }),
      ],
    });
  }

  private buildLabelValuesLayout(variableState: CustomConstantVariableState) {
    const tagKey = String(variableState?.value);
    const query = buildLokiQuery(this.getExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

    let bodyOpts = PanelBuilders.timeseries();
    bodyOpts = bodyOpts
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLeverColorOverrides)
      .setTitle(tagKey);

    const body = bodyOpts.build();
    const { sortBy, direction } = getSortByPreference('labels', ReducerID.stdDev, 'desc');
    const getFilter = () => this.state.search.state.filter ?? '';

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
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_LABELS
          ),
          sortBy,
          direction,
          getFilter,
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
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_LABELS
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  private getExpr(tagKey: string) {
    const labelsVariable = getLabelsVariable(this);
    const fieldsVariable = getFieldsVariable(this);

    let labelExpressionToAdd;
    let fieldExpressionToAdd = '';
    // `LEVEL_VARIABLE_VALUE` is a special case where we don't want to add this to the stream selector
    if (tagKey !== LEVEL_VARIABLE_VALUE) {
      labelExpressionToAdd = { key: tagKey, operator: '!=', value: '' };
    } else {
      fieldExpressionToAdd = `| ${LEVEL_VARIABLE_VALUE} != ""`;
    }
    const streamSelectors = [...labelsVariable.state.filters, labelExpressionToAdd]
      .filter(isDefined)
      .map((f) => `${f.key}${f.operator}\`${f.value}\``)
      .join(',');

    const fields = fieldsVariable.state.filters;
    // if we have fields, we also need to add `VAR_LOGS_FORMAT_EXPR`
    if (fields.length) {
      return `sum(count_over_time({${streamSelectors}} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} [$__auto])) by (${tagKey})`;
    }
    return `sum(count_over_time({${streamSelectors}} ${fieldExpressionToAdd} ${VAR_LINE_FILTER_EXPR} ${VAR_PATTERNS_EXPR} [$__auto])) by (${tagKey})`;
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();
    variable.changeValueTo(value);

    const { sortBy, direction } = getSortByPreference('labels', ReducerID.stdDev, 'desc');
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        label: value,
        previousLabel: variable.getValueText(),
        view: 'labels',
        sortBy,
        sortByDirection: direction,
      }
    );

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.label, value, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { body, loading, blockingMessage, error, search, sort } = model.useState();
    const variable = model.getVariable();
    const { options, value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {body instanceof LayoutSwitcher && <body.Selector model={body} />}
            {!loading && value !== ALL_VARIABLE_VALUE && (
              <>
                <sort.Component model={sort} />
                <search.Component model={search} />
              </>
            )}
            {!loading && options.length > 0 && (
              <FieldSelector label="Label" options={options} value={String(value)} onChange={model.onChange} />
            )}
          </div>
          {error && (
            <Alert title="" severity="warning">
              The labels are not available at this moment. Try using a different time range or check again later.
            </Alert>
          )}
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
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
      gap: theme.spacing(2),
    }),
  };
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export function buildLabelBreakdownActionScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({}),
      }),
    ],
  });
}

export function buildLabelValuesBreakdownActionScene(value: string) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({ value }),
      }),
    ],
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.label, this.state.labelName, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Select
      </Button>
    );
  };
}
