import React from 'react';

import { LoadingState, PanelData } from '@grafana/data';
import {
  QueryRunnerState,
  SceneComponentProps,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { getQueryRunner, getResourceQueryRunner } from 'services/panel';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, ValueSlugs } from 'services/routing';
import {
  getDataSourceVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getServiceNameFromVariableState,
  LOG_STREAM_SELECTOR_EXPR,
  SERVICE_NAME,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';
import { getMetadataService } from '../../services/metadata';
import { navigateToIndex } from '../../services/navigate';
import { areArraysEqual } from '../../services/comparison';
import { ActionBarScene } from './ActionBarScene';
import { breakdownViewsDefinitions, TabNames, valueBreakdownViews } from './BreakdownViews';

const LOGS_PANEL_QUERY_REFID = 'logsPanelQuery';
const PATTERNS_QUERY_REFID = 'patterns';
const DETECTED_LABELS_QUERY_REFID = 'detectedLabels';
const DETECTED_FIELDS_QUERY_REFID = 'detectedFields';

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

type ServiceSceneLoadingStates = {
  [name in TabNames]: boolean;
};

export interface ServiceSceneCustomState {
  labelsCount?: number;
  patternsCount?: number;
  fieldsCount?: number;
  loading?: boolean;
}

export interface ServiceSceneState extends SceneObjectState, ServiceSceneCustomState {
  body: SceneFlexLayout | undefined;
  drillDownLabel?: string;
  $data: SceneDataProvider | undefined;
  $patternsData: SceneQueryRunner | undefined;
  $detectedLabelsData: SceneQueryRunner | undefined;
  $detectedFieldsData: SceneQueryRunner | undefined;
  loadingStates: ServiceSceneLoadingStates;
}

export function getLogsPanelFrame(data: PanelData | undefined) {
  return data?.series.find((series) => series.refId === LOGS_PANEL_QUERY_REFID);
}

export function getDetectedLabelsFrame(sceneRef: SceneObject) {
  const serviceScene = sceneGraph.getAncestor(sceneRef, ServiceScene);
  return serviceScene.state.$detectedLabelsData?.state.data?.series?.[0];
}

export function getDetectedFieldsFrame(sceneRef: SceneObject) {
  const serviceScene = sceneGraph.getAncestor(sceneRef, ServiceScene);
  return getDetectedFieldsFrameFromQueryRunnerState(serviceScene.state.$detectedFieldsData?.state);
}

export const getDetectedFieldsFrameFromQueryRunnerState = (state?: QueryRunnerState) => {
  // Only ever one frame in the response
  return state?.data?.series?.[0];
};

export const getDetectedFieldsNamesFromQueryRunnerState = (state: QueryRunnerState) => {
  // The first field, DETECTED_FIELDS_NAME_FIELD, has the list of names of the detected fields
  return state.data?.series?.[0]?.fields?.[0];
};

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS, VAR_LEVELS],
  });

  public constructor(
    state: MakeOptional<
      ServiceSceneState,
      'body' | '$data' | '$patternsData' | '$detectedLabelsData' | '$detectedFieldsData' | 'loadingStates'
    >
  ) {
    super({
      loadingStates: {
        [TabNames.patterns]: false,
        [TabNames.labels]: false,
        [TabNames.fields]: false,
        [TabNames.logs]: false,
      },
      loading: true,
      body: state.body ?? buildGraphScene(),
      $data: getServiceSceneQueryRunner(),
      $patternsData: getPatternsQueryRunner(),
      $detectedLabelsData: getDetectedLabelsQueryRunner(),
      $detectedFieldsData: getDetectedFieldsQueryRunner(),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private setSubscribeToLabelsVariable() {
    const variable = getLabelsVariable(this);
    if (variable.state.filters.length === 0) {
      this.redirectToStart();
      return;
    }
    this._subs.add(
      variable.subscribeToState((newState, prevState) => {
        const newServiceName = getServiceNameFromVariableState(newState);
        const prevServiceName = getServiceNameFromVariableState(prevState);
        if (newState.filters.length === 0) {
          this.redirectToStart();
        }
        // If we remove the service name filter, we should redirect to the start
        if (!newState.filters.some((f) => f.key === SERVICE_NAME)) {
          this.redirectToStart();
        }

        // Clear filters if changing service, they might not exist, or might have a different parser
        if (prevServiceName !== newServiceName) {
          const fields = getFieldsVariable(this);
          fields.setState({
            filters: [],
          });
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
      $detectedLabelsData: undefined,
      $detectedFieldsData: undefined,
      patternsCount: undefined,
      labelsCount: undefined,
      fieldsCount: undefined,
    });
    getMetadataService().setServiceSceneState(this.state);
    this._subs.unsubscribe();

    this.clearAdHocVariables();

    // Redirect to root with updated params, which will trigger history push back to index route, preventing empty page or empty service query bugs
    navigateToIndex();
  }

  /**
   * If the scene has previously been activated, we can see cached variable states when re-activating
   * To prevent this we clear out the variable filters
   */
  private clearAdHocVariables = () => {
    const variables = [getLabelsVariable(this), getFieldsVariable(this), getLevelsVariable(this)];
    variables.forEach((variable) => {
      variable.setState({
        filters: [],
      });
    });
  };

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
    this.setSubscribeToLabelsVariable();

    // Run queries on activate
    this.runQueries();

    // Query Subscriptions
    this._subs.add(this.subscribeToPatternsQuery());
    this._subs.add(this.subscribeToDetectedLabelsQuery());
    this._subs.add(this.subscribeToDetectedFieldsQuery());
    this._subs.add(this.subscribeToLogsQuery());

    // Variable subscriptions
    this._subs.add(this.subscribeToLabelsVariable());
    this._subs.add(this.subscribeToFieldsVariable());
    this._subs.add(this.subscribeToDataSourceVariable());

    // Update query runner on manual time range change
    this._subs.add(this.subscribeToTimeRange());
  }

  private subscribeToDataSourceVariable() {
    return getDataSourceVariable(this).subscribeToState(() => {
      this.redirectToStart();
    });
  }

  private subscribeToLabelsVariable() {
    return getLabelsVariable(this).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$patternsData?.runQueries();
        this.state.$detectedLabelsData?.runQueries();
        this.state.$detectedFieldsData?.runQueries();
      }
    });
  }

  private subscribeToFieldsVariable() {
    return getFieldsVariable(this).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$detectedFieldsData?.runQueries();
      }
    });
  }

  private runQueries() {
    const slug = getDrilldownSlug();
    const parentSlug = getDrilldownValueSlug();

    // If we don't have a patterns count in the tabs, or we are activating the patterns scene, run the pattern query
    if (slug === PageSlugs.patterns || this.state.patternsCount === undefined) {
      this.state.$patternsData?.runQueries();
    }

    // If we don't have a detected labels count, or we are activating the labels scene, run the detected labels query
    if (slug === PageSlugs.labels || this.state.labelsCount === undefined) {
      this.state.$detectedLabelsData?.runQueries();
    }

    // If we don't have a detected fields count, or we are activating the fields scene, run the detected fields query
    if (slug === PageSlugs.fields || parentSlug === ValueSlugs.field || this.state.fieldsCount === undefined) {
      this.state.$detectedFieldsData?.runQueries();
    }
  }

  private subscribeToPatternsQuery() {
    return this.state.$patternsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.patterns);
      if (newState.data?.state === LoadingState.Done) {
        const patternsResponse = newState.data.series;
        if (patternsResponse?.length !== undefined) {
          // Save the count of patterns to state
          this.setState({
            patternsCount: patternsResponse.length,
          });
          getMetadataService().setPatternsCount(patternsResponse.length);
        }
      }
    });
  }

  private subscribeToDetectedLabelsQuery() {
    return this.state.$detectedLabelsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.labels);
      if (newState.data?.state === LoadingState.Done) {
        const detectedLabelsResponse = newState.data;
        // Detected labels API call always returns a single frame, with a field for each label
        const detectedLabelsFields = detectedLabelsResponse.series[0].fields;
        if (detectedLabelsResponse.series.length !== undefined && detectedLabelsFields.length !== undefined) {
          this.setState({
            // Make sure to add one extra for the detected_level
            labelsCount: detectedLabelsFields.length + 1,
          });
          getMetadataService().setLabelsCount(detectedLabelsFields.length);
        }
      }
    });
  }

  private updateLoadingState(newState: SceneDataState, key: keyof ServiceSceneLoadingStates) {
    const loadingStates = this.state.loadingStates;
    loadingStates[key] = newState.data?.state === LoadingState.Loading;
    // set loading state to true if any of the queries are loading
    const loading = Object.values(loadingStates).some((v) => v);
    this.setState({ loading, loadingStates });
  }

  private subscribeToLogsQuery() {
    return this.state.$data?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.logs);
    });
  }

  private subscribeToDetectedFieldsQuery() {
    return this.state.$detectedFieldsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.fields);
      if (newState.data?.state === LoadingState.Done) {
        const detectedFieldsResponse = newState.data;
        const detectedFieldsFields = detectedFieldsResponse.series[0];
        if (detectedFieldsFields !== undefined && detectedFieldsFields.length !== this.state.fieldsCount) {
          this.setState({
            fieldsCount: detectedFieldsFields.length,
          });
          getMetadataService().setFieldsCount(detectedFieldsFields.length);
        }
      }
    });
  }

  private subscribeToTimeRange() {
    return sceneGraph.getTimeRange(this).subscribeToState(() => {
      this.state.$patternsData?.runQueries();
      this.state.$detectedLabelsData?.runQueries();
      this.state.$detectedFieldsData?.runQueries();
    });
  }

  private resetBodyAndData() {
    let stateUpdate: Partial<ServiceSceneState> = {};

    if (!this.state.$data) {
      stateUpdate.$data = getServiceSceneQueryRunner();
    }

    if (!this.state.$patternsData) {
      stateUpdate.$patternsData = getPatternsQueryRunner();
    }

    if (!this.state.$detectedLabelsData) {
      stateUpdate.$detectedLabelsData = getDetectedLabelsQueryRunner();
    }

    if (!this.state.$detectedFieldsData) {
      stateUpdate.$detectedFieldsData = getDetectedFieldsQueryRunner();
    }

    if (!this.state.body) {
      stateUpdate.body = buildGraphScene();
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
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
          breakdownViewDef.getScene((length) => {
            if (breakdownViewDef.value === 'fields') {
              this.setState({ fieldsCount: length });
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
        body: new ActionBarScene({}),
      }),
    ],
  });
}

function getPatternsQueryRunner() {
  return getResourceQueryRunner([
    buildResourceQuery(`{${VAR_LABELS_EXPR}}`, 'patterns', { refId: PATTERNS_QUERY_REFID }),
  ]);
}

function getDetectedLabelsQueryRunner() {
  return getResourceQueryRunner([
    buildResourceQuery(`{${VAR_LABELS_EXPR}}`, 'detected_labels', { refId: DETECTED_LABELS_QUERY_REFID }),
  ]);
}

function getDetectedFieldsQueryRunner() {
  return getResourceQueryRunner([
    buildResourceQuery(LOG_STREAM_SELECTOR_EXPR, 'detected_fields', { refId: DETECTED_FIELDS_QUERY_REFID }),
  ]);
}

function getServiceSceneQueryRunner() {
  return getQueryRunner([buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID })]);
}
