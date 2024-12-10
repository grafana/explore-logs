import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, DataFrame, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  QueryRunnerState,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
  SceneVariableState,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { Alert, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { checkPrimaryLabel, getPrimaryLabelFromUrl, ValueSlugs } from 'services/routing';
import { ALL_VARIABLE_VALUE, SERVICE_NAME, SERVICE_UI_LABEL, VAR_LABEL_GROUP_BY, VAR_LABELS } from 'services/variables';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { StatusWrapper } from './StatusWrapper';
import { getLabelOptions } from 'services/filters';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { getSortByPreference } from 'services/store';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { getDetectedLabelsFrame, ServiceScene } from '../ServiceScene';
import { CustomConstantVariable, CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { areArraysEqual } from '../../../services/comparison';
import { LabelValuesBreakdownScene } from './LabelValuesBreakdownScene';
import { LabelsAggregatedBreakdownScene } from './LabelsAggregatedBreakdownScene';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { EmptyLayoutScene } from './EmptyLayoutScene';
import { getLabelGroupByVariable, getLabelsVariable } from '../../../services/variableGetters';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
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
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const groupByVariable = getLabelGroupByVariable(this);

    this.setState({
      loading: serviceScene.state.$detectedLabelsData?.state.data?.state !== LoadingState.Done,
      error: serviceScene.state.$detectedLabelsData?.state.data?.state === LoadingState.Error,
    });

    this._subs.add(
      this.subscribeToEvent(BreakdownSearchReset, () => {
        this.state.search.clearValueFilter();
      })
    );
    this._subs.add(this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange));

    this._subs.add(serviceScene.state.$detectedLabelsData?.subscribeToState(this.onDetectedLabelsDataChange));

    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        this.onLabelsVariableChange(newState, prevState);
      })
    );

    this._subs.add(
      groupByVariable.subscribeToState((newState, prevState) => {
        this.onGroupByVariableChange(newState, prevState);
      })
    );

    const detectedLabelsFrame = getDetectedLabelsFrame(this);
    // Need to update labels with current state
    if (detectedLabelsFrame) {
      this.updateOptions(detectedLabelsFrame);
    }

    checkPrimaryLabel(this);
  }

  private onGroupByVariableChange(newState: CustomConstantVariableState, prevState: CustomConstantVariableState) {
    // If the aggregation value changed, or the body is not yet defined
    if (
      newState.value !== prevState.value ||
      !areArraysEqual(newState.options, prevState.options) ||
      this.state.body === undefined ||
      this.state.body instanceof EmptyLayoutScene
    ) {
      this.updateBody();
    }
  }

  private onLabelsVariableChange(
    newState: SceneVariableState & { filters: AdHocVariableFilter[] },
    prevState: SceneVariableState & { filters: AdHocVariableFilter[] }
  ) {
    let { labelName } = getPrimaryLabelFromUrl();
    if (labelName === SERVICE_UI_LABEL) {
      labelName = SERVICE_NAME;
    }
    const variable = getLabelGroupByVariable(this);
    const newPrimaryLabel = newState.filters.find((filter) => filter.key === labelName);
    const prevPrimaryLabel = prevState.filters.find((filter) => filter.key === labelName);

    // If the user changes the service
    if (variable.state.value === ALL_VARIABLE_VALUE && newPrimaryLabel !== prevPrimaryLabel) {
      this.setState({
        loading: true,
        body: undefined,
        error: undefined,
      });
    }
  }

  /**
   * Pull the detected_labels from our service scene, update the variable when they change
   * @param newState
   * @param prevState
   */
  private onDetectedLabelsDataChange = (newState: QueryRunnerState, prevState: QueryRunnerState) => {
    if (
      newState.data?.state === LoadingState.Done &&
      newState.data.series?.[0] &&
      !areArraysEqual(newState.data.series?.[0]?.fields, prevState.data?.series?.[0]?.fields)
    ) {
      this.updateOptions(newState.data.series?.[0]);
    } else if (newState.data?.state === LoadingState.Done) {
      // we got a new response, but nothing changed, just need to clear loading
      const variable = getLabelGroupByVariable(this);
      variable.setState({
        loading: false,
      });
    }
  };

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }
    const body = this.state.body;
    if (body instanceof LabelValuesBreakdownScene) {
      const byFrameRepeaters = sceneGraph.findDescendents(body, ByFrameRepeater);
      byFrameRepeaters.forEach((layout) => {
        layout.sort(event.sortBy, event.direction);
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

  private updateOptions(detectedLabels: DataFrame | undefined) {
    if (!detectedLabels || !detectedLabels.length) {
      this.setState({
        loading: false,
        body: new EmptyLayoutScene({ type: 'labels' }),
      });
      return;
    }
    const variable = getLabelGroupByVariable(this);
    const options = getLabelOptions(detectedLabels.fields.map((label) => label.name));

    variable.setState({
      loading: false,
      options,
      value: this.state.value ?? ALL_VARIABLE_VALUE,
    });
  }

  private updateBody() {
    const variable = getLabelGroupByVariable(this);
    // We get the labels from the service scene, if we don't have them yet, assume we're loading
    if (!variable.state.options || !variable.state.options.length) {
      return;
    }

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      blockingMessage: undefined,
      error: false,
    };

    if (variable.hasAllValue() && this.state.body instanceof LabelValuesBreakdownScene) {
      stateUpdate.body = new LabelsAggregatedBreakdownScene({});
    } else if (!variable.hasAllValue() && this.state.body instanceof LabelsAggregatedBreakdownScene) {
      stateUpdate.body = new LabelValuesBreakdownScene({});
    } else if (this.state.body === undefined) {
      if (variable.state.options.length > 0) {
        stateUpdate.body = variable.hasAllValue()
          ? new LabelsAggregatedBreakdownScene({})
          : new LabelValuesBreakdownScene({});
      } else {
        stateUpdate.body = new EmptyLayoutScene({ type: 'labels' });
      }
    } else if (this.state.body instanceof EmptyLayoutScene) {
      if (variable.state.options.length > 0) {
        stateUpdate.body = variable.hasAllValue()
          ? new LabelsAggregatedBreakdownScene({})
          : new LabelValuesBreakdownScene({});
      }
    }

    this.setState({ ...stateUpdate });
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = getLabelGroupByVariable(this);
    variable.changeValueTo(value);

    const { sortBy, direction } = getSortByPreference('labels', DEFAULT_SORT_BY, 'desc');
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

  public static LabelsMenu = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { body, loading, search } = model.useState();
    const variable = getLabelGroupByVariable(model);
    const { options, value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.labelsMenuWrapper}>
        {body instanceof LabelValuesBreakdownScene && <LabelValuesBreakdownScene.Selector model={body} />}
        {body instanceof LabelsAggregatedBreakdownScene && <LabelsAggregatedBreakdownScene.Selector model={body} />}
        {body instanceof LabelValuesBreakdownScene && <search.Component model={search} />}
        {!loading && options.length > 0 && (
          <FieldSelector label="Label" options={options} value={String(value)} onChange={model.onChange} />
        )}
      </div>
    );
  };

  public static ValuesMenu = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { loading, sort } = model.useState();
    const variable = getLabelGroupByVariable(model);
    const { value } = variable.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.valuesMenuWrapper}>
        {!loading && value !== ALL_VARIABLE_VALUE && (
          <>
            <sort.Component model={sort} />
          </>
        )}
      </div>
    );
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { body, loading, blockingMessage, error } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          {error && (
            <Alert title="" severity="warning">
              The labels are not available at this moment. Try using a different time range or check again later.
            </Alert>
          )}

          {body instanceof LabelsAggregatedBreakdownScene && model && <LabelBreakdownScene.LabelsMenu model={model} />}

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
      gap: theme.spacing(1),
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    labelsMenuWrapper: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
      gap: theme.spacing(2),
    }),
    valuesMenuWrapper: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
      flexDirection: 'row',
    }),
  };
}
