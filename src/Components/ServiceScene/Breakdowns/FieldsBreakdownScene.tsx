import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import {
  ALL_VARIABLE_VALUE,
  getFieldGroupByVariable,
  getFieldsVariable,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_FIELD_GROUP_BY,
  VAR_LABELS,
} from 'services/variables';
import { ServiceScene, ServiceSceneState } from '../ServiceScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { StatusWrapper } from './StatusWrapper';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { getSortByPreference } from 'services/store';
import { GrotError } from '../../GrotError';
import { IndexScene } from '../../IndexScene/IndexScene';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { getFieldOptions } from '../../../services/filters';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { areArraysEqual } from '../../../services/comparison';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';
import { FieldValuesBreakdownScene } from './FieldValuesBreakdownScene';
import { SERVICE_NAME } from '../../ServiceSelectionScene/ServiceSelectionScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { DEFAULT_SORT_BY } from '../../../services/sorting';

export const averageFields = ['duration', 'count', 'total', 'bytes'];
export const FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?: SceneReactObject | FieldsAggregatedBreakdownScene | FieldValuesBreakdownScene | SceneFlexLayout;
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
    const groupByVariable = getFieldGroupByVariable(this);
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    // Subscriptions
    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));
    this._subs.add(serviceScene.subscribeToState(this.serviceFieldsChanged));
    this._subs.add(groupByVariable.subscribeToState(this.variableChanged));

    this._subs.add(
      getFieldsVariable(this).subscribeToState((newState, prevState) => {
        const variable = getFieldGroupByVariable(this);
        const newService = newState.filters.find((filter) => filter.key === SERVICE_NAME);
        const prevService = prevState.filters.find((filter) => filter.key === SERVICE_NAME);

        // If the user changes the service
        if (variable.state.value === ALL_VARIABLE_VALUE && newService !== prevService) {
          this.setState({
            loading: true,
            body: undefined,
          });
        }
      })
    );

    this.updateFields(serviceScene.state);
  }

  private variableChanged = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
    if (
      !newState.loading &&
      (!areArraysEqual(newState.options, oldState.options) || newState.value !== oldState.value)
    ) {
      this.updateBody(newState);
    }
  };

  private serviceFieldsChanged = (newState: ServiceSceneState, oldState: ServiceSceneState) => {
    if (newState.loading === false && !areArraysEqual(newState.fields, oldState.fields)) {
      this.updateFields(newState);
    }
  };

  private updateFields(state: ServiceSceneState) {
    const variable = getFieldGroupByVariable(this);
    const options = state.fields ? getFieldOptions(state.fields) : [];

    variable.setState({
      options,
      value: state.drillDownLabel ?? ALL_VARIABLE_VALUE,
    });

    // If we were in an error state or undefined, let's update the new body
    if (
      !(
        this.state.body instanceof FieldsAggregatedBreakdownScene ||
        this.state.body instanceof FieldValuesBreakdownScene
      )
    ) {
      this.updateBody(getFieldGroupByVariable(this).state);
    }
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'fields') {
      return;
    }
    if (this.state.body instanceof FieldValuesBreakdownScene && this.state.body.state.body instanceof LayoutSwitcher) {
      this.state.body.state.body?.state.layouts.forEach((layout) => {
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
      // If there's 1 or fewer fields build the empty or clear layout UI
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variables = sceneGraph.getVariables(indexScene);
      let variablesToClear: SceneVariable[] = [];

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
      // Otherwise update the body, but don't re-instantiate if it's already the right class
      if (newState.value === ALL_VARIABLE_VALUE && this.state.body instanceof FieldValuesBreakdownScene) {
        stateUpdate.body = new FieldsAggregatedBreakdownScene({});
      } else if (newState.value !== ALL_VARIABLE_VALUE && this.state.body instanceof FieldsAggregatedBreakdownScene) {
        stateUpdate.body = new FieldValuesBreakdownScene({});
      } else if (
        this.state.body === undefined ||
        this.state.body instanceof SceneFlexLayout ||
        this.state.body instanceof SceneReactObject
      ) {
        stateUpdate.body =
          newState.value === ALL_VARIABLE_VALUE
            ? new FieldsAggregatedBreakdownScene({})
            : new FieldValuesBreakdownScene({});
      }
    }

    this.setState(stateUpdate);
  }

  private clearVariables = (variablesToClear: SceneVariable[]) => {
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

  public onFieldSelectorChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = getFieldGroupByVariable(this);
    const { sortBy, direction } = getSortByPreference('fields', DEFAULT_SORT_BY, 'desc');

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
    const variable = getFieldGroupByVariable(model);
    const { options, value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {/*{body instanceof LayoutSwitcher && <body.Selector model={body} />}*/}
            {body instanceof FieldsAggregatedBreakdownScene && <FieldsAggregatedBreakdownScene.Selector model={body} />}
            {body instanceof FieldValuesBreakdownScene && <FieldValuesBreakdownScene.Selector model={body} />}
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

          {/* @todo why are the types like this? */}
          <div className={styles.content}>
            {body && body instanceof FieldsAggregatedBreakdownScene && <body.Component model={body} />}
            {body && body instanceof FieldValuesBreakdownScene && <body.Component model={body} />}
            {body && body instanceof SceneReactObject && <body.Component model={body} />}
            {body && body instanceof SceneFlexLayout && <body.Component model={body} />}
          </div>
        </StatusWrapper>
      </div>
    );
  };
}

export const emptyStateStyles = {
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

export function isAvgField(field: string) {
  return averageFields.includes(field);
}

export function getFieldBreakdownExpr(field: string) {
  if (isAvgField(field)) {
    return (
      `avg_over_time(${LOG_STREAM_SELECTOR_EXPR} | unwrap ` +
      (field === 'duration' ? `duration` : field === 'bytes' ? `bytes` : ``) +
      `(${field}) [$__auto]) by ()`
    );
  }
  return `sum by (${field}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${field}!=""   [$__auto]))`;
}
