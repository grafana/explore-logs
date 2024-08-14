import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, LoadingState, ReducerID } from '@grafana/data';
import {
  PanelBuilders,
  QueryRunnerState,
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
  SceneVariableSet,
  VariableDependencyConfig,
  VariableValueOption,
} from '@grafana/scenes';
import { Alert, Button, DrawStyle, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildDataQuery } from 'services/query';
import { ValueSlugs } from 'services/routing';
import {
  ALL_VARIABLE_VALUE,
  getLabelGroupByVariable,
  getLabelsVariable,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_LABEL_GROUP_BY,
  VAR_LABEL_GROUP_BY_EXPR,
  VAR_LABELS,
} from 'services/variables';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';
import { getLabelOptions } from 'services/filters';
import { BreakdownSearchReset, BreakdownSearchScene } from './BreakdownSearchScene';
import { getSortByPreference } from 'services/store';
import { SortByScene, SortCriteriaChanged } from './SortByScene';
import { ServiceScene } from '../ServiceScene';
import { CustomConstantVariable } from '../../../services/CustomConstantVariable';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { areArraysEqual } from '../../../services/comparison';
import { LabelValueBreakdownScene } from './LabelValueBreakdownScene';

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

    // Need to update labels with current state
    if (serviceScene.state.$detectedLabelsData?.state.data?.series?.[0]) {
      this.updateLabels(serviceScene.state.$detectedLabelsData.state.data?.series?.[0]);
    }

    this._subs.add(serviceScene.state.$detectedLabelsData?.subscribeToState(this.onLabelsChange));
    // const variable = getLabelGroupByVariable(this);
    // this._subs.add(variable.subscribeToState(this.onVariableStateChange));

    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        // If we're in the label breakdown, and not the value breakdown
        if (this.state.body instanceof LayoutSwitcher) {
          console.log('clear body, set loading');
          // Clear body and set loading state so we don't fire queries before the new detected_labels response has come back which will update the options
          this.setState({
            loading: true,
            body: undefined,
          });
        }
      })
    );

    this.updateBody();
  }
  //
  // /**
  //  * Update body when variable state is updated, although I think we want this to happen whenever the $detectedLabels response changes instead?
  //  * @param newState
  //  * @param oldState
  //  */
  // private onVariableStateChange = (newState: CustomConstantVariableState, oldState: CustomConstantVariableState) => {
  //   console.log('group variable ANY change', newState, oldState)
  //   if (
  //     !areArraysEqual(newState.options, oldState.options) ||
  //     newState.value !== oldState.value ||
  //     (newState.loading !== oldState.loading && newState.loading === false)
  //   ) {
  //
  //     console.log('group by variable action change', newState, oldState, this.state.body)
  //     this.updateBody();
  //   }
  // };

  /**
   * Pull the detected_labels from our service scene, update the variable when they change
   * @param newState
   */
  private onLabelsChange = (newState: QueryRunnerState, prevState: QueryRunnerState) => {
    if (
      newState.data?.state === LoadingState.Done &&
      !areArraysEqual(newState.data.series?.[0]?.fields, prevState.data?.series?.[0]?.fields)
    ) {
      this.updateLabels(newState.data.series?.[0]);
      this.updateBody();
    }
  };

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

  private updateLabels(detectedLabels: DataFrame | undefined) {
    if (!detectedLabels || !detectedLabels.length) {
      console.warn('detectedLabels empty', detectedLabels);
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

    let fieldExpressionToAdd = '';

    if (variable.state.value) {
      fieldExpressionToAdd = `| ${variable.state.value} != ""`;
    }

    const query = buildDataQuery(
      `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} ${fieldExpressionToAdd} [$__auto])) by (${VAR_LABEL_GROUP_BY_EXPR})`,
      { legendFormat: `{{${VAR_LABEL_GROUP_BY_EXPR}}}`, refId: 'LABEL_BREAKDOWN_VALUES' }
    );

    // We don't want to re-instantiate the labelValueBreakdown scene, as it has a query runner that will re-run when the variable dependecies change
    // But we do want to rebuild the body for labels as we clear out the body on change of labels
    // @todo, create new scene for labelsLayout?
    if (!(this.state.body instanceof LabelValueBreakdownScene && !variable.hasAllValue())) {
      stateUpdate.body = variable.hasAllValue()
        ? this.buildLabelsLayout(variable.state.options)
        : new LabelValueBreakdownScene({ $data: getQueryRunner([query]) });
    }

    this.setState({ ...stateUpdate });
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

      let fieldExpressionToAdd = '';

      if (option.value) {
        fieldExpressionToAdd = `| ${option.value} != ""`;
      }

      const query = buildDataQuery(
        `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} ${fieldExpressionToAdd} [$__auto])) by (${optionValue})`,
        { legendFormat: `{{${optionValue}}}`, refId: 'LABEL_BREAKDOWN_NAMES' }
      );

      children.push(
        new SceneCSSGridItem({
          body: PanelBuilders.timeseries()
            .setTitle(optionValue)
            .setData(
              getQueryRunner([
                // buildDataQuery(getTimeSeriesExpr(this, optionValue), { legendFormat: `{{${optionValue}}}` }),
                query,
              ])
            )
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
          templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
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

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = getLabelGroupByVariable(this);
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
    const variable = getLabelGroupByVariable(model);
    const { options, value } = variable.useState();
    const styles = useStyles2(getStyles);
    console.log('render', {
      loading,
      body,
      error,
    });

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {body instanceof LayoutSwitcher && <body.Selector model={body} />}
            {body instanceof LabelValueBreakdownScene && <LabelValueBreakdownScene.Selector model={body} />}
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

export const LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

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
class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
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
