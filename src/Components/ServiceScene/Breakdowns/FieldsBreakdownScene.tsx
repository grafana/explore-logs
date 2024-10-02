import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  AdHocFiltersVariable,
  QueryRunnerState,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  SceneVariable,
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { Alert, Button, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getSortByPreference } from 'services/store';
import { ALL_VARIABLE_VALUE, SERVICE_NAME, SERVICE_UI_LABEL, VAR_FIELD_GROUP_BY, VAR_LABELS } from 'services/variables';
import { areArraysEqual } from '../../../services/comparison';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { checkPrimaryLabel, getPrimaryLabelFromUrl, ValueSlugs } from '../../../services/routing';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { GrotError } from '../../GrotError';
import { IndexScene } from '../../IndexScene/IndexScene';
import { getDetectedFieldsFrame, ServiceScene } from '../ServiceScene';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldsAggregatedBreakdownScene } from './FieldsAggregatedBreakdownScene';
import { FieldSelector } from './FieldSelector';
import { FieldValuesBreakdownScene } from './FieldValuesBreakdownScene';
import { LayoutSwitcher } from './LayoutSwitcher';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { StatusWrapper } from './StatusWrapper';
import { getFieldOptions } from 'services/filters';
import { EmptyLayoutScene } from './EmptyLayoutScene';
import { getFieldGroupByVariable, getLabelsVariable } from '../../../services/variableGetters';

export const averageFields = ['duration', 'count', 'total', 'bytes'];
export const FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export interface FieldsBreakdownSceneState extends SceneObjectState {
  body?:
    | (SceneReactObject & SceneObject)
    | (FieldsAggregatedBreakdownScene & SceneObject)
    | (FieldValuesBreakdownScene & SceneObject)
    | (EmptyLayoutScene & SceneObject);
  search: BreakdownSearchScene;
  sort: SortByScene;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  changeFieldCount?: (n: number) => void;
}

export class FieldsBreakdownScene extends SceneObjectBase<FieldsBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
  });

  constructor(state: Partial<FieldsBreakdownSceneState> & { options?: VariableValueOption[]; value?: string }) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [
            new CustomConstantVariable({
              name: VAR_FIELD_GROUP_BY,
              defaultToAll: false,
              includeAll: true,
              value: state.value ?? ALL_VARIABLE_VALUE,
              options: state.options ?? [],
            }),
          ],
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

    this.setState({
      loading: serviceScene.state.$detectedLabelsData?.state.data?.state !== LoadingState.Done,
    });

    // Subscriptions
    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));
    this._subs.add(groupByVariable.subscribeToState(this.variableChanged));

    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        const variable = getFieldGroupByVariable(this);
        let { labelName } = getPrimaryLabelFromUrl();

        const newService = newState.filters.find((filter) => filter.key === labelName);
        const prevService = prevState.filters.find((filter) => filter.key === labelName);

        // If the user changes the primary label
        if (variable.state.value === ALL_VARIABLE_VALUE && newService !== prevService) {
          this.setState({
            loading: true,
            body: undefined,
          });
        }
      })
    );

    this._subs.add(
      serviceScene.state.$detectedFieldsData?.subscribeToState(
        (newState: QueryRunnerState, oldState: QueryRunnerState) => {
          if (newState.data?.state === LoadingState.Done) {
            if (newState.data.series?.[0]) {
              this.updateOptions(newState.data.series?.[0]);
            }
          }
        }
      )
    );

    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    // Need to update labels with current state
    if (detectedFieldsFrame) {
      this.updateOptions(detectedFieldsFrame);
    }

    checkPrimaryLabel(this);
  }

  private variableChanged = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
    if (
      newState.value !== oldState.value ||
      !areArraysEqual(newState.options, oldState.options) ||
      this.state.body === undefined ||
      this.state.body instanceof EmptyLayoutScene ||
      this.state.body instanceof SceneReactObject
    ) {
      this.updateBody(newState);
    }
  };

  private updateOptions(dataFrame: DataFrame) {
    if (!dataFrame || !dataFrame.length) {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variablesToClear = this.getVariablesThatCanBeCleared(indexScene);

      let body;
      if (variablesToClear.length > 1) {
        this.state.changeFieldCount?.(0);
        body = this.buildClearFiltersLayout(() => this.clearVariables(variablesToClear));
      } else {
        body = new EmptyLayoutScene({ type: 'fields' });
      }
      this.setState({
        loading: false,
        body,
      });
      return;
    }

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const variable = getFieldGroupByVariable(this);
    variable.setState({
      options: getFieldOptions(dataFrame.fields[0].values.map((v) => String(v))),
      loading: false,
      value: serviceScene.state.drillDownLabel ?? ALL_VARIABLE_VALUE,
    });
    this.setState({
      loading: false,
    });
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
    const fieldsVariable = getFieldGroupByVariable(this);

    // We get the labels from the service scene, if we don't have them yet, assume we're loading
    if (!fieldsVariable.state.options || !fieldsVariable.state.options.length) {
      return;
    }

    const stateUpdate: Partial<FieldsBreakdownSceneState> = {};

    if (fieldsVariable.state.options && fieldsVariable.state.options.length <= 1) {
      // If there's 1 or fewer fields build the empty or clear layout UI
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const variablesToClear = this.getVariablesThatCanBeCleared(indexScene);

      if (variablesToClear.length > 1) {
        this.state.changeFieldCount?.(0);
        stateUpdate.body = this.buildClearFiltersLayout(() => this.clearVariables(variablesToClear));
      } else {
        stateUpdate.body = new EmptyLayoutScene({ type: 'fields' });
      }
    } else {
      // Otherwise update the body, but don't re-instantiate if it's already the right class
      if (newState.value === ALL_VARIABLE_VALUE && this.state.body instanceof FieldValuesBreakdownScene) {
        stateUpdate.body = new FieldsAggregatedBreakdownScene({});
      } else if (newState.value !== ALL_VARIABLE_VALUE && this.state.body instanceof FieldsAggregatedBreakdownScene) {
        stateUpdate.body = new FieldValuesBreakdownScene({});
      } else if (
        // If the body hasn't been created, or the no-data views are active, we want to replace and render the correct scene
        this.state.body === undefined ||
        this.state.body instanceof EmptyLayoutScene ||
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

  private getVariablesThatCanBeCleared(indexScene: IndexScene) {
    const variables = sceneGraph.getVariables(indexScene);
    let variablesToClear: SceneVariable[] = [];

    for (const variable of variables.state.variables) {
      if (variable instanceof AdHocFiltersVariable && variable.state.filters.length) {
        variablesToClear.push(variable);
      }
      if (variable instanceof CustomConstantVariable && variable.state.value && variable.state.name !== 'logsFormat') {
        variablesToClear.push(variable);
      }
    }
    return variablesToClear;
  }

  private clearVariables = (variablesToClear: SceneVariable[]) => {
    // clear patterns: needs to happen first, or it won't work as patterns is split into a variable and a state, and updating the variable triggers a state update
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    indexScene.setState({
      patterns: [],
    });

    variablesToClear.forEach((variable) => {
      if (variable instanceof AdHocFiltersVariable && variable.state.key === 'adhoc_service_filter') {
        let { labelName } = getPrimaryLabelFromUrl();
        // getPrimaryLabelFromUrl returns the label name that exists in the URL, which is "service" not "service_name"
        if (labelName === SERVICE_UI_LABEL) {
          labelName = SERVICE_NAME;
        }
        variable.setState({
          filters: variable.state.filters.filter((filter) => filter.key === labelName),
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

          <div className={styles.content}>{body && <body.Component model={body} />}</div>
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
