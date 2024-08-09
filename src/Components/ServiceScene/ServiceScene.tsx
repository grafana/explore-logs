import React from 'react';

import {AdHocVariableFilter, LoadingState, PanelData} from '@grafana/data';
import {
  QueryRunnerState,
  SceneComponentProps,
  SceneDataProvider,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariable,
  SceneVariableState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import {LoadingPlaceholder} from '@grafana/ui';
import {DetectedLabel, DetectedLabelsResponse, updateParserFromDataFrame} from 'services/fields';
import {getQueryRunner} from 'services/panel';
import {buildDataQuery, buildResourceQuery} from 'services/query';
import {getDrilldownSlug, getDrilldownValueSlug, PageSlugs, PLUGIN_ID} from 'services/routing';
import {getLokiDatasource} from 'services/scenes';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';
import {sortLabelsByCardinality} from 'services/filters';
import {SERVICE_NAME} from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import {getMetadataService} from '../../services/metadata';
import {navigateToIndex} from '../../services/navigate';
import {areArraysEqual} from '../../services/comparison';
import {LogsActionBarScene} from './LogsActionBarScene';
import {breakdownViewsDefinitions, valueBreakdownViews} from './BreakdownViews';
import {Unsubscribable} from "rxjs";

const LOGS_PANEL_QUERY_REFID = 'logsPanelQuery';
const PATTERNS_QUERY_REFID = 'patterns';

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ServiceSceneCustomState {
  fields?: string[];
  labels?: DetectedLabel[];
  patternsCount?: number;
  fieldsCount?: number;
  loading?: boolean;
}

export interface ServiceSceneState extends SceneObjectState, ServiceSceneCustomState {
  body: SceneFlexLayout | undefined;
  drillDownLabel?: string;
  $data: SceneDataProvider;
  dataSubscriber?: Unsubscribable
}

interface AdHocFilterWithLabels extends AdHocVariableFilter {
  keyLabel?: string;
  valueLabel?: string;
}

export function getLogsPanelFrame(data: PanelData | undefined) {
  return data?.series.find((series) => series.refId === LOGS_PANEL_QUERY_REFID);
}

export function getPatternsFrames(data: PanelData | undefined) {
  return data?.series.filter((series) => series.refId === PATTERNS_QUERY_REFID);
}

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS, VAR_LEVELS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  public constructor(state: MakeOptional<ServiceSceneState, 'body' | '$data'>) {
    super({
      body: state.body ?? buildGraphScene(),
      $data: getServiceSceneQueryRunner(),
      loading: true,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private setEmptyFiltersRedirection() {
    const variable = getLabelsVariable(this);
    if (variable.state.filters.length === 0) {
      this.redirectToStart();
      return;
    }
    this._subs.add(
      variable.subscribeToState((newState) => {
        console.log('service scene set empty filters labels variable on change', newState)
        if (newState.filters.length === 0) {
          this.redirectToStart();
        }
        // If we remove the service name filter, we should redirect to the start
        if (!newState.filters.some((f) => f.key === SERVICE_NAME)) {
          this.redirectToStart();
        }
      })
    );
  }

  private redirectToStart() {
    // Clear ongoing queries
    this.setState({
      $data: undefined,
      body: undefined,
    });
    // Redirect to root with updated params, which will trigger history push back to index route, preventing empty page or empty service query bugs
    navigateToIndex();
  }

  /**
   * After routing we need to pull any data set to the service scene by other routes from the metadata singleton,
   * as each route has a different instantiation of this scene
   * @private
   */
  private getMetadata() {
    const metadataService = getMetadataService();
    const state = metadataService.getServiceSceneState();

    if (state) {
      this.setState({
        ...state,
      });
    }
  }

  private onActivate() {
    this.getMetadata();
    this.resetBodyAndData();

    this.setBreakdownView();
    this.setEmptyFiltersRedirection();
    this.updateLabels();

    this.onDataChange();
    this.updateQueryRunnerOnVariableChange();
    this.updateQueryRunnerOnTimeChange();

    return () => {
      console.log('deactivate service scene', this)
      const sub = this.state.dataSubscriber

      if(sub){
        sub?.unsubscribe()
      }
      this._subs.unsubscribe()
      this._subs.remove(this._subs)
    }
  }

  private onDataChange() {
    const dataSubscriber = this.state.$data.subscribeToState((newStateUntyped, prevState) => {
      console.log('service scene data change', newStateUntyped)
      const newState = newStateUntyped as QueryRunnerState;
      const logsPanelResponse = getLogsPanelFrame(newState.data);
      const prevLogsPanelResponse = getLogsPanelFrame(prevState.data);

      const patternsResponse = getPatternsFrames(newState.data);

      if (logsPanelResponse && !areArraysEqual(prevLogsPanelResponse?.fields, logsPanelResponse.fields)) {
        this.updateFields();
      }

      if (
          newState.data?.state === LoadingState.Done &&
          patternsResponse?.length !== undefined &&
          this.state.patternsCount !== patternsResponse.length &&
          newState.queries.some(query => query.refId === PATTERNS_QUERY_REFID)
      ) {
        console.log('setting pattern length', {
          length: patternsResponse.length,
          newState,
          prevState,
          patternsResponse
        })
        // Save the count of patterns to state
        this.setState({
          patternsCount: patternsResponse.length,
        });
        getMetadataService().setPatternsCount(patternsResponse.length);
      }
    })

    this.setState({
      dataSubscriber
    })

    this._subs.add(
        dataSubscriber
    );
  }

  /**
   * Update query runner on manual time range change
   * @private
   */
  private updateQueryRunnerOnTimeChange() {

    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        // console.log('update query runner on time range change')
        // this.setState({
        //   $data: getServiceSceneQueryRunner(true),
        // });

        // this.updateLabels();
      })
    );
  }


  /**
   * Update query runners
   * @private
   */
  private updateQueryRunnerOnVariableChange() {
    const labels = getLabelsVariable(this);
    this._subs.add(
        labels.subscribeToState((newState, prevState) => {
          console.log('service scene labels change', newState)
          this.updateQueryRunnerOnChange(newState, prevState, true);
        })
    );

    const fields = getFieldsVariable(this);
    this._subs.add(
        fields.subscribeToState((newState, prevState) => {
          console.log('service scene fields change', newState)
          this.updateQueryRunnerOnChange(newState, prevState, false);
        })
    );

    const levels = getLevelsVariable(this);
    this._subs.add(
      levels.subscribeToState((newState, prevState) => {
        console.log('service scene levels change', newState)
        this.updateQueryRunnerOnChange(newState, prevState, false);
      })
    );

  }

// @todo scenes doesn't export AdHocFiltersVariableState
  private updateQueryRunnerOnChange(
    newState: SceneVariableState & { filters: AdHocFilterWithLabels[] },
    prevState: SceneVariableState & { filters: AdHocFilterWithLabels[] },
    forceRefresh: boolean
  ) {
    if (!areArraysEqual(newState.filters, prevState.filters)) {
      const queryRunner = getQueryRunnerFromProvider(this.state.$data);
      const newQueryRunner = getQueryRunnerFromProvider(getServiceSceneQueryRunner(forceRefresh));

      // If the queries changed, update the data provider
      if (!areArraysEqual(queryRunner.state.queries, newQueryRunner.state.queries)) {
        console.log('queries changed, new data provider')
        // Clear out the old provider
        if(this.state.dataSubscriber){
          this.state.dataSubscriber.unsubscribe()
        }
        this.setState({
          $data: newQueryRunner,
        });
      }
    }
  }

  private resetBodyAndData() {
    let stateUpdate: Partial<ServiceSceneState> = {};

    stateUpdate.$data = getServiceSceneQueryRunner();

    if (!this.state.body) {
      stateUpdate.body = buildGraphScene();
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
  }

  private onReferencedVariableValueChanged(variable: SceneVariable) {
    if (variable.state.name === VAR_DATASOURCE) {
      this.redirectToStart();
      return;
    }

    const filterVariable = getLabelsVariable(this);
    if (filterVariable.state.filters.length === 0) {
      return;
    }
    Promise.all([this.updateLabels()]).catch((err) => {
      console.error('Failed to update', err);
    });
  }

  private updateFields() {
    const disabledFields = [
      '__time',
      'timestamp',
      'time',
      'datetime',
      'date',
      'timestamp_ms',
      'timestamp_us',
      'ts',
      'traceID',
      'trace',
      'spanID',
      'span',
      'referer',
      'user_identifier',
    ];
    const newState = sceneGraph.getData(this).state;
    const frame = getLogsPanelFrame(newState.data);
    if (frame) {
      const res = updateParserFromDataFrame(frame, this);
      const fields = res.fields.filter((f) => !disabledFields.includes(f)).sort((a, b) => a.localeCompare(b));
      if (!areArraysEqual(fields, this.state.fields)) {
        this.setState({
          fields: fields,
          loading: false,
        });
      }
    } else {
      this.setState({
        fields: [],
        loading: false,
      });
    }
  }

  private async updateLabels() {
    const ds = await getLokiDatasource(this);

    if (!ds) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(this);

    const timeRangeValue = timeRange.state.value;
    const filters = getLabelsVariable(this);

    const { detectedLabels } = await ds.getResource<DetectedLabelsResponse>(
      'detected_labels',
      {
        query: filters.state.filterExpression,
        start: timeRangeValue.from.utc().toISOString(),
        end: timeRangeValue.to.utc().toISOString(),
      },
      {
        headers: {
          'X-Query-Tags': `Source=${PLUGIN_ID}`,
        },
      }
    );

    if (!detectedLabels || !Array.isArray(detectedLabels)) {
      return;
    }

    const labels = detectedLabels
      .sort((a, b) => sortLabelsByCardinality(a, b))
      .filter((label) => label.label !== LEVEL_VARIABLE_VALUE);

    if (!areArraysEqual(labels, this.state.labels)) {
      this.setState({ labels });
    }
  }

  public setBreakdownView() {
    const { body } = this.state;
    const breakdownView = getDrilldownSlug();
    const breakdownViewDef = breakdownViewsDefinitions.find((v) => v.value === breakdownView);

    if (!body) {
      throw new Error('body is not defined in setBreakdownView!');
    }

    if (breakdownViewDef) {
      body.setState({
        children: [
          ...body.state.children.slice(0, 1),
          breakdownViewDef.getScene((vals) => {
            if (breakdownViewDef.value === 'fields') {
              this.setState({ fieldsCount: vals.length });
            }
          }),
        ],
      });
    } else {
      const valueBreakdownView = getDrilldownValueSlug();
      const valueBreakdownViewDef = valueBreakdownViews.find((v) => v.value === valueBreakdownView);

      if (valueBreakdownViewDef && this.state.drillDownLabel) {
        body.setState({
          children: [...body.state.children.slice(0, 1), valueBreakdownViewDef.getScene(this.state.drillDownLabel)],
        });
      } else {
        console.error('not setting breakdown view');
      }
    }
  }

  static Component = ({ model }: SceneComponentProps<ServiceScene>) => {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}

function buildGraphScene() {
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        ySizing: 'content',
        body: new LogsActionBarScene({}),
      }),
    ],
  });
}

/**
 * @todo find a better way to do this?
 * @param forceRefresh
 */
export function getServiceSceneQueryRunner(forceRefresh = false) {
  const slug = getDrilldownSlug();
  const metadataService = getMetadataService();
  const state = metadataService.getServiceSceneState();

  // We only need to query patterns on pages besides the patterns view to show the number of patterns in the tab. If that's already been set, let's skip requesting it again.
  if (slug !== PageSlugs.patterns && state?.patternsCount !== undefined && !forceRefresh) {
    console.log('updating query runner, logs only')
    return getQueryRunner([buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID })]);
  }

  console.log('updating query runner, both')
  return getQueryRunner([
    buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID }),
    buildResourceQuery(VAR_LABELS_EXPR, 'patterns', { refId: PATTERNS_QUERY_REFID }),
  ]);
}

function getQueryRunnerFromProvider(queryRunner: SceneDataProvider): SceneQueryRunner {
  if (queryRunner instanceof SceneQueryRunner) {
    return queryRunner;
  }

  if (queryRunner.state.$data instanceof SceneQueryRunner) {
    return queryRunner.state.$data;
  }

  throw new Error('Cannot find query runner');
}
