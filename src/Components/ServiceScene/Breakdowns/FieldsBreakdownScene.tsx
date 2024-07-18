import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  SceneVariable,
  SceneVariableSet,
  SceneVariableState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Button, DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getFilterBreakdownValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import {
  ALL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FIELD_GROUP_BY,
  VAR_FIELDS,
  VAR_LABELS,
} from 'services/variables';
import { ServiceScene, ServiceSceneState } from '../ServiceScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { getLabelValue, SortByScene, SortCriteriaChanged } from './SortByScene';
import { getSortByPreference } from 'services/store';
import { GrotError } from '../../GrotError';
import { IndexScene } from '../../IndexScene/IndexScene';
import { LazySceneCSSGridItem } from './LazySceneCSSGridItem';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { getLabelOptions } from '../../../services/filters';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  search: BreakdownSearchScene;
  sort: SortByScene;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  changeFields?: (n: string[]) => void;
}

export class FieldsBreakdownScene extends SceneObjectBase<FieldsBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
  });

  constructor(state: Partial<FieldsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomConstantVariable({ name: VAR_FIELD_GROUP_BY, defaultToAll: false, includeAll: true })],
        }),
      loading: true,
      sort: new SortByScene({ target: 'fields' }),
      search: new BreakdownSearchScene('fields'),
      value: state.value ?? ALL_VARIABLE_VALUE,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const variable = this.getVariable();
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // Subscriptions
    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));
    this._subs.add(serviceScene.subscribeToState(this.serviceFieldsChanged));
    this._subs.add(variable.subscribeToState(this.variableChanged));

    this.updateFields(serviceScene.state);
  }

  private variableChanged = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
    if (
      JSON.stringify(newState.options) !== JSON.stringify(oldState.options) ||
      newState.value !== oldState.value ||
      newState.loading !== oldState.loading
    ) {
      this.updateBody(newState);
    }
  };

  private serviceFieldsChanged = (newState: ServiceSceneState, oldState: ServiceSceneState) => {
    if (JSON.stringify(newState.fields) !== JSON.stringify(oldState.fields) || newState.loading !== oldState.loading) {
      this.updateFields(newState);
    }
  };

  private updateFields(state: ServiceSceneState) {
    const variable = this.getVariable();
    const options = state.fields ? getLabelOptions(state.fields) : [];

    variable.setState({
      options,
      value: state.drillDownLabel ?? ALL_VARIABLE_VALUE,
      loading: state.loading,
    });
  }

  private getVariable(): CustomConstantVariable {
    const variable = sceneGraph.lookupVariable(VAR_FIELD_GROUP_BY, this)!;
    if (!(variable instanceof CustomConstantVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private hideField(field: string) {
    const logsScene = sceneGraph.getAncestor(this, ServiceScene);

    const fields = logsScene.state.fields?.filter((f) => f !== field);

    if (fields) {
      this.state.changeFields?.(fields.filter((f) => f !== ALL_VARIABLE_VALUE).map((f) => f));
    }
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'fields') {
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
        target: 'fields',
        criteria: event.sortBy,
        direction: event.direction,
      }
    );
  };

  private updateBody(newState: CustomConstantVariableState) {
    const logsScene = sceneGraph.getAncestor(this, ServiceScene);

    const stateUpdate: Partial<FieldsBreakdownSceneState> = {
      value: String(newState.value),
      blockingMessage: undefined,
      loading: logsScene.state.loading,
    };

    if (logsScene.state.fields && logsScene.state?.fields.length <= 1) {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variables = sceneGraph.getVariables(indexScene);
      let variablesToClear: Array<SceneVariable<SceneVariableState>> = [];

      for (const variable of variables.state.variables) {
        if (variable instanceof AdHocFiltersVariable && variable.state.filters.length) {
          variablesToClear.push(variable);
        }
        if (
          variable instanceof CustomConstantVariable &&
          variable.state.value &&
          variable.state.name !== 'logsFormat'
        ) {
          variablesToClear.push(variable);
        }
      }

      if (variablesToClear.length > 1) {
        stateUpdate.body = this.buildClearFiltersLayout(() => this.clearVariables(variablesToClear));
      } else {
        stateUpdate.body = this.buildEmptyLayout();
      }
    } else {
      stateUpdate.body =
        newState.value === ALL_VARIABLE_VALUE
          ? this.buildFieldsLayout(newState.options.map((opt) => ({ label: opt.label, value: String(opt.value) })))
          : this.buildValuesLayout(newState);
    }

    this.setState(stateUpdate);
  }

  private clearVariables = (variablesToClear: Array<SceneVariable<SceneVariableState>>) => {
    // clear patterns: needs to happen first, or it won't work as patterns is split into a variable and a state, and updating the variable triggers a state update
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    indexScene.setState({
      patterns: [],
    });

    variablesToClear.forEach((variable) => {
      if (variable instanceof AdHocFiltersVariable && variable.state.key === 'adhoc_service_filter') {
        variable.setState({
          filters: variable.state.filters.filter((filter) => filter.key === 'service_name'),
        });
      } else if (variable instanceof AdHocFiltersVariable) {
        variable.setState({
          filters: [],
        });
      } else if (variable instanceof CustomConstantVariable) {
        variable.setState({
          value: '',
          text: '',
        });
      }
    });
  };

  private buildEmptyLayout() {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new SceneReactObject({
            reactNode: (
              <GrotError>
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
              </GrotError>
            ),
          }),
        }),
      ],
    });
  }

  private buildClearFiltersLayout(clearCallback: () => void) {
    return new SceneReactObject({
      reactNode: (
        <GrotError>
          <Alert title="" severity="info">
            No labels match these filters.{' '}
            <Button className={emptyStateStyles.button} onClick={() => clearCallback()}>
              Clear filters
            </Button>{' '}
          </Alert>
        </GrotError>
      ),
    });
  }

  private buildFieldsLayout(options: Array<SelectableValue<string>>) {
    this.state.search.reset();

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
      const gridItem = new LazySceneCSSGridItem({
        body: body.build(),
      });

      this._subs.add(
        queryRunner.getResultsStream().subscribe((result) => {
          if (result.data.errors && result.data.errors.length > 0) {
            const val = result.data.errors[0].refId!;
            this.hideField(val);
            gridItem.setState({ isHidden: true });
          }
        })
      );

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

  buildValuesLayout(variableState: CustomConstantVariableState) {
    const tagKey = String(variableState.value);
    const query = buildLokiQuery(getExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

    const { sortBy, direction } = getSortByPreference('fields', ReducerID.stdDev, 'desc');
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
              body: PanelBuilders.timeseries().setTitle(tagKey).build(),
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
            isLazy: true,
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_FIELDS
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  public onFieldSelectorChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();
    const { sortBy, direction } = getSortByPreference('fields', ReducerID.stdDev, 'desc');

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        field: value,
        previousField: variable.getValueText(),
        view: 'fields',
        sortBy,
        sortByDirection: direction,
      }
    );

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.field, value, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<FieldsBreakdownScene>) => {
    const { body, loading, blockingMessage, search, sort } = model.useState();
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
            {!loading && options.length > 1 && (
              <FieldSelector
                label="Field"
                options={options}
                value={String(value)}
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
  button: css({
    marginLeft: '1.5rem',
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

export function buildFieldsBreakdownActionScene(changeFieldNumber: (n: string[]) => void) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ changeFields: changeFieldNumber }),
      }),
    ],
  });
}

export function buildFieldValuesBreakdownActionScene(value: string) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new FieldsBreakdownScene({ value }),
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
    navigateToValueBreakdown(ValueSlugs.field, this.state.labelName, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Select
      </Button>
    );
  };
}
