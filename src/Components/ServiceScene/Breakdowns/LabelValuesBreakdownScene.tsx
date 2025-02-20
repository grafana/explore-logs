import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getLabelValue } from './SortByScene';
import { DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { getSortByPreference } from '../../../services/store';
import { AppEvents, DataQueryError, LoadingState } from '@grafana/data';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import {
  ALL_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  VAR_LABEL_GROUP_BY_EXPR,
  VAR_LABELS,
} from '../../../services/variables';
import React from 'react';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { AddFilterEvent } from './AddToFiltersButton';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from '../../../services/labels';
import { getAppEvents } from '@grafana/runtime';
import {
  getFieldsAndMetadataVariable,
  getLabelGroupByVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getPatternsVariable,
} from '../../../services/variableGetters';
import { getPanelWrapperStyles, PanelMenu } from '../../Panels/PanelMenu';
import { NoMatchingLabelsScene } from './NoMatchingLabelsScene';
import { EmptyLayoutScene } from './EmptyLayoutScene';
import { IndexScene } from '../../IndexScene/IndexScene';
import { clearVariables, getVariablesThatCanBeCleared } from '../../../services/variableHelpers';
import { ValueSummaryPanelScene } from './Panels/ValueSummary';
import { LevelsVariableScene } from '../../IndexScene/LevelsVariableScene';
import { renderLevelsFilter, renderLogQLLabelFilters } from '../../../services/query';
import { logger } from '../../../services/logger';
import { areArraysEqual } from '../../../services/comparison';

type DisplayError = DataQueryError & { displayed: boolean };
type DisplayErrors = Record<string, DisplayError>;

export interface LabelValueBreakdownSceneState extends SceneObjectState {
  body?: (LayoutSwitcher & SceneObject) | (NoMatchingLabelsScene & SceneObject) | (EmptyLayoutScene & SceneObject);
  $data?: SceneDataProvider;
  errors: DisplayErrors;
}

export class LabelValuesBreakdownScene extends SceneObjectBase<LabelValueBreakdownSceneState> {
  constructor(state: Partial<LabelValueBreakdownSceneState>) {
    super({
      ...state,
      errors: {},
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      $data: getQueryRunner(
        [buildLabelsQuery(this, VAR_LABEL_GROUP_BY_EXPR, String(getLabelGroupByVariable(this).state.value))],
        { runQueriesMode: 'manual' }
      ),
      body: this.build(),
    });

    // Run query on activate
    this.runQuery();
    this.setSubs();
  }

  /**
   * Set variable & event subscriptions
   */
  private setSubs() {
    // EVENT SUBS
    // Subscribe to AddFilterEvent to sync button filters with variable state
    this._subs.add(
      this.subscribeToEvent(AddFilterEvent, (event) => {
        const levelsVariableScene = sceneGraph.findObject(this, (obj) => obj instanceof LevelsVariableScene);
        if (levelsVariableScene instanceof LevelsVariableScene) {
          levelsVariableScene.onFilterChange();
        }
      })
    );

    // QUERY RUNNER SUBS
    // Subscribe to value breakdown state
    this._subs.add(
      this.state.$data?.subscribeToState((newState, prevState) => {
        this.onValuesDataQueryChange(newState);
      })
    );

    // VARIABLE SUBS
    // Subscribe to label change via dropdown
    this._subs.add(
      getLabelGroupByVariable(this).subscribeToState((newState) => {
        if (newState.value === ALL_VARIABLE_VALUE) {
          this.setState({
            $data: undefined,
            body: undefined,
          });
        }
      })
    );

    // Subscribe to time range changes
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        // Run query on time range change
        this.runQuery();
      })
    );

    // Subscribe to fields variable changes
    this._subs.add(
      getFieldsAndMetadataVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to line filter variable changes
    this._subs.add(
      getLineFiltersVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to pattern variable changes
    this._subs.add(
      getPatternsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.runQuery();
        }
      })
    );

    // if this label is detected level
    if (this.getTagKey() === LEVEL_VARIABLE_VALUE) {
      // Subscribe to the labels variable
      this._subs.add(
        getLabelsVariable(this).subscribeToState(async (newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            // Check to see if excluding this label changes the query string before running
            // If the filter change was for the label we're looking at, there's no need to re-run the query
            const partialFilterExpression = this.removeValueLabelFromVariableInterpolation();
            const filterExpression = renderLogQLLabelFilters(newState.filters, [this.getTagKey()]);

            if (partialFilterExpression !== filterExpression) {
              const queryRunner = this.getSceneQueryRunner();
              queryRunner?.runQueries();
            }
          }
        })
      );
    } else {
      //otherwise subscribe to levels variable
      this._subs.add(
        getLevelsVariable(this).subscribeToState(async (newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            // Check to see if excluding this label changes the query string before running
            // If the filter change was for the label we're looking at, there's no need to re-run the query
            const partialFilterExpression = this.removeValueLabelFromVariableInterpolation();
            const filterExpression = renderLevelsFilter(newState.filters, [this.getTagKey()]);

            if (partialFilterExpression !== filterExpression) {
              const queryRunner = this.getSceneQueryRunner();
              queryRunner?.runQueries();
            }
          }
        })
      );
    }
  }

  /**
   * Run the label values breakdown query.
   * Generates the filterExpression excluding all filters with a key that matches the label.
   */
  private runQuery() {
    // Update the filters to exclude the current value so all options are displayed to the user
    this.removeValueLabelFromVariableInterpolation();
    const queryRunner = this.getSceneQueryRunner();
    queryRunner?.runQueries();
  }

  /**
   * Helper method that grabs the SceneQueryRunner for the label value breakdown query.
   */
  private getSceneQueryRunner() {
    if (this.state.$data) {
      const queryRunners = sceneGraph.findDescendents(this.state.$data, SceneQueryRunner);
      if (queryRunners.length !== 1) {
        const error = new Error('Unable to find query runner in value breakdown!');
        logger.error(error, { msg: 'LabelValuesBreakdownScene: Unable to find query runner in value breakdown!' });
        throw error;
      }

      return queryRunners[0];
    }
    logger.warn('LabelValuesBreakdownScene: Query is attempting to execute, but query runner is undefined!');
    return undefined;
  }

  /**
   * Generates the filterExpression for the label value query and saves it to state.
   * We have to manually generate the filterExpression as we want to exclude every filter for the target variable that matches the key used in this value breakdown.
   * e.g. in the "cluster" breakdown, we don't want to execute this query containing a cluster filter, or users will only be able to include a single value.
   *
   * Note: As soon as the variable filters are updated the filterExpression is overwritten,
   * so we need to update the filterExpression before each manual query execution.
   */
  private removeValueLabelFromVariableInterpolation() {
    const tagKey = this.getTagKey();
    let filterExpression;

    if (tagKey === LEVEL_VARIABLE_VALUE) {
      const levelsVar = getLevelsVariable(this);
      filterExpression = renderLevelsFilter(levelsVar.state.filters, [tagKey]);
      levelsVar.setState({
        filterExpression,
      });
    } else {
      const labelsVar = getLabelsVariable(this);
      filterExpression = renderLogQLLabelFilters(labelsVar.state.filters, [tagKey]);
      labelsVar.setState({
        filterExpression,
      });
    }

    return filterExpression;
  }

  /**
   * Helper method to get the key/label name from the variable on the parent scene
   */
  private getTagKey() {
    const variable = getLabelGroupByVariable(this);
    return String(variable.state.value);
  }

  private onValuesDataQueryChange(newState: SceneDataState) {
    // Set empty states
    this.setEmptyStates(newState);

    // Set error states
    this.setErrorStates(newState);
  }

  private setErrorStates(newState: SceneDataState) {
    // If panels have errors
    if (newState?.data?.errors && newState.data?.state !== LoadingState.Done) {
      const errors: DisplayErrors = this.state.errors;
      newState?.data?.errors.forEach((err) => {
        const errorIndex = `${err.status}_${err.traceId}_${err.message}`;
        if (errors[errorIndex] === undefined) {
          errors[errorIndex] = { ...err, displayed: false };
        }
      });
      this.setState({
        errors,
      });

      this.showErrorToast(this.state.errors);
    }
  }

  private setEmptyStates(newState: SceneDataState) {
    if (newState.data?.state === LoadingState.Done) {
      if (newState.data.series.length > 0 && !(this.state.body instanceof LayoutSwitcher)) {
        this.setState({
          body: this.build(),
        });
      } else if (newState.data.series.length === 0) {
        const indexScene = sceneGraph.getAncestor(this, IndexScene);
        const variablesToClear = getVariablesThatCanBeCleared(indexScene);

        if (variablesToClear.length > 1) {
          this.setState({
            body: new NoMatchingLabelsScene({ clearCallback: () => clearVariables(this) }),
          });
        } else {
          this.setState({
            body: new EmptyLayoutScene({ type: 'fields' }),
          });
        }
      }
    }
  }

  private getActiveLayout(): SceneFlexLayout | undefined {
    const layoutSwitcher = this.state.body;
    if (layoutSwitcher instanceof LayoutSwitcher) {
      const activeLayout = layoutSwitcher?.state.layouts.find((layout) => layout.isActive);
      if (activeLayout instanceof SceneFlexLayout) {
        return activeLayout;
      }
    }
    return undefined;
  }

  private activeLayoutContainsNoPanels(): boolean {
    const activeLayout = this.getActiveLayout();
    if (activeLayout) {
      const byFrameRepeaters = sceneGraph.findDescendents(activeLayout, ByFrameRepeater);
      return byFrameRepeaters.some((repeater) => {
        const child = repeater.state.body.state.children[0];
        return child instanceof SceneFlexItem || child instanceof SceneReactObject;
      });
    }

    return false;
  }

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const variableState = variable.state;
    const tagKey = String(variableState?.value);
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);

    let bodyOpts = PanelBuilders.timeseries();
    bodyOpts = bodyOpts
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      // Waiting for 11.5
      // .setShowMenuAlways(true)
      .setOverrides(setLevelColorOverrides)
      .setMenu(new PanelMenu({}))
      .setTitle(tagKey);

    const body = bodyOpts.build();

    const { sortBy, direction } = getSortByPreference('labels', DEFAULT_SORT_BY, 'desc');

    const getFilter = () => labelBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
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
            new SceneReactObject({ reactNode: <LabelBreakdownScene.LabelsMenu model={labelBreakdownScene} /> }),
            new SceneFlexItem({
              minHeight: 300,
              body,
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({ reactNode: <LabelBreakdownScene.LabelsMenu model={labelBreakdownScene} /> }),
            new ValueSummaryPanelScene({ title: tagKey, levelColor: true, tagKey: this.getTagKey(), type: 'label' }),
            new SceneReactObject({ reactNode: <LabelBreakdownScene.ValuesMenu model={labelBreakdownScene} /> }),
            new ByFrameRepeater({
              body: new SceneCSSGridLayout({
                isLazy: true,
                templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
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
                DrawStyle.Bars,
                VAR_LABELS,
                sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort,
                tagKey
              ),
              sortBy,
              direction,
              getFilter,
            }),
          ],
        }),
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({ reactNode: <LabelBreakdownScene.LabelsMenu model={labelBreakdownScene} /> }),
            new ValueSummaryPanelScene({ title: tagKey, levelColor: true, tagKey: this.getTagKey(), type: 'label' }),
            new SceneReactObject({ reactNode: <LabelBreakdownScene.ValuesMenu model={labelBreakdownScene} /> }),
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
                DrawStyle.Bars,
                VAR_LABELS,
                sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort,
                tagKey
              ),
              sortBy,
              direction,
              getFilter,
            }),
          ],
        }),
      ],
    });
  }

  private showErrorToast(errors: DisplayErrors) {
    const appEvents = getAppEvents();

    // Make sure we only display each error once
    let errorArray: DisplayError[] = [];
    for (const err in errors) {
      const displayError = errors[err];
      if (!displayError.displayed) {
        errorArray.push(displayError);
        displayError.displayed = true;
      }
    }

    if (errorArray.length) {
      // If we don't have any panels the error message will replace the loading state, we want to set it as displayed but not render the toast
      if (!this.activeLayoutContainsNoPanels()) {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: errorArray?.map((err, key) => this.renderError(key, err)),
        });
      }
      this.setState({
        errors,
      });
    }
  }

  private renderError(key: number, err: DataQueryError) {
    return (
      <div key={key}>
        {err.status && (
          <>
            <strong>Status</strong>: {err.status} <br />
          </>
        )}
        {err.message && (
          <>
            <strong>Message</strong>: {err.message} <br />
          </>
        )}
        {err.traceId && (
          <>
            <strong>TraceId</strong>: {err.traceId}
          </>
        )}
      </div>
    );
  }

  public static Selector({ model }: SceneComponentProps<LabelValuesBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && body instanceof LayoutSwitcher && <LayoutSwitcher.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelValuesBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (body) {
      return <span className={styles.panelWrapper}>{body && <body.Component model={body} />}</span>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
