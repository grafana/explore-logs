import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';
import {
  SceneComponentProps,
  SceneDataProvider,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { DetectedLabel, DetectedLabelsResponse, updateParserFromDataFrame } from 'services/fields';
import { getQueryRunner, getResourceQueryRunner } from 'services/panel';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, PLUGIN_ID } from 'services/routing';
import { getLokiDatasource } from 'services/scenes';
import {
  getLabelsVariable,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';
import { sortLabelsByCardinality } from 'services/filters';
import { SERVICE_NAME } from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import { getMetadataService } from '../../services/metadata';
import { navigateToDrilldownPage, navigateToIndex } from '../../services/navigate';
import { areArraysEqual } from '../../services/comparison';
import { LogsActionBarScene } from './LogsActionBarScene';
import { breakdownViewsDefinitions, valueBreakdownViews } from './BreakdownViews';

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
  $patternsData: SceneQueryRunner;
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

  public constructor(state: MakeOptional<ServiceSceneState, 'body' | '$data' | '$patternsData'>) {
    super({
      loading: true,
      body: state.body ?? buildGraphScene(),
      $data: getServiceSceneQueryRunner(),
      $patternsData: getPatternsQueryRunner(),
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
      $patternsData: undefined,
      patternsCount: undefined,
    });
    getMetadataService().setServiceSceneState(this.state);
    this._subs.unsubscribe();
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
    const slug = getDrilldownSlug();

    // If we don't have a patterns count in the tabs, or we are activating the patterns scene, run the pattern query
    if ((this.state.patternsCount === undefined || slug === 'patterns') && !this.state.$patternsData.state.data) {
      this.state.$patternsData.runQueries();
    }

    this._subs.add(
      this.state.$data.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          const logsPanelResponse = getLogsPanelFrame(newState.data);
          if (logsPanelResponse) {
            this.updateFields();
          }
        }
      })
    );

    this._subs.add(
      this.state.$patternsData.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          const patternsResponse = getPatternsFrames(newState.data);
          if (patternsResponse?.length !== undefined) {
            // Save the count of patterns to state
            this.setState({
              patternsCount: patternsResponse.length,
            });
            getMetadataService().setPatternsCount(patternsResponse.length);
          }
        }
      })
    );

    this.updateLabels();

    const labels = getLabelsVariable(this);
    this._subs.add(
      labels.subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.state.$patternsData.runQueries();
        }
      })
    );

    // Update query runner on manual time range change
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.updateLabels();
        this.state.$patternsData.runQueries();
      })
    );
  }

  private resetBodyAndData() {
    let stateUpdate: Partial<ServiceSceneState> = {};

    if (!this.state.$data) {
      stateUpdate.$data = getServiceSceneQueryRunner();
    }

    if (!this.state.$patternsData) {
      stateUpdate.$patternsData = getPatternsQueryRunner();
    }

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
    Promise.all([this.updateLabels()])
      .finally(() => {
        // For patterns, we don't want to reload to logs as we allow users to select multiple patterns
        if (variable.state.name !== VAR_PATTERNS) {
          navigateToDrilldownPage(PageSlugs.logs, this);
        }
      })
      .catch((err) => {
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
    if (frame && newState.data?.state === LoadingState.Done) {
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

function getPatternsQueryRunner() {
  return getResourceQueryRunner([buildResourceQuery(VAR_LABELS_EXPR, 'patterns', { refId: PATTERNS_QUERY_REFID })]);
}

function getServiceSceneQueryRunner() {
  return getQueryRunner([buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID })]);
}
