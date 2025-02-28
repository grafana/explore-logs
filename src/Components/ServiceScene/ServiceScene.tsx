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
  SceneVariableValueChangedEvent,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { getQueryRunner, getResourceQueryRunner } from 'services/panel';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import {
  EMPTY_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  SERVICE_NAME,
  SERVICE_UI_LABEL,
  stripAdHocFilterUserInputPrefix,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';
import { getMetadataService } from '../../services/metadata';
import { navigateToDrilldownPage, navigateToIndex, navigateToValueBreakdown } from '../../services/navigate';
import { areArraysEqual } from '../../services/comparison';
import { ActionBarScene } from './ActionBarScene';
import { breakdownViewsDefinitions, TabNames, valueBreakdownViews } from './BreakdownViews';
import {
  getDataSourceVariable,
  getFieldsAndMetadataVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../services/variableGetters';
import { logger } from '../../services/logger';
import { IndexScene, showLogsButtonSceneKey } from '../IndexScene/IndexScene';
import {
  getDrilldownSlug,
  getDrilldownValueSlug,
  getPrimaryLabelFromUrl,
  PageSlugs,
  ValueSlugs,
} from '../../services/routing';
import { replaceSlash } from '../../services/extensions/links';
import { ShowLogsButtonScene } from '../IndexScene/ShowLogsButtonScene';
import { migrateLineFilterV1 } from '../../services/migrations';
import { VariableHide } from '@grafana/schema';
import { LEVELS_VARIABLE_SCENE_KEY, LevelsVariableScene } from '../IndexScene/LevelsVariableScene';
import { isOperatorInclusive } from '../../services/operatorHelpers';

export const LOGS_PANEL_QUERY_REFID = 'logsPanelQuery';
export const LOGS_COUNT_QUERY_REFID = 'logsCountQuery';
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
  totalLogsCount?: number;
  logsCount?: number;
}

export interface ServiceSceneState extends SceneObjectState, ServiceSceneCustomState {
  body: SceneFlexLayout | undefined;
  drillDownLabel?: string;
  $data: SceneDataProvider | undefined;
  $logsCount: SceneQueryRunner | undefined;
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

export const getDetectedFieldsParsersFromQueryRunnerState = (state: QueryRunnerState) => {
  // The third field, DETECTED_FIELDS_PARSER_NAME, has the list of parsers of the detected fields
  return state.data?.series?.[0]?.fields?.[2];
};

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS, VAR_LEVELS],
  });

  public constructor(
    state: MakeOptional<
      ServiceSceneState,
      | 'body'
      | '$data'
      | '$patternsData'
      | '$detectedLabelsData'
      | '$detectedFieldsData'
      | 'loadingStates'
      | '$logsCount'
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
      $logsCount: getLogCountQueryRunner(),
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
        if (newState.filters.length === 0) {
          this.redirectToStart();
        }

        // If we remove the service name filter, we should redirect to the start
        let { labelName, labelValue, breakdownLabel } = getPrimaryLabelFromUrl();

        // Before we dynamically pulled label filter keys into the URL, we had hardcoded "service" as the primary label slug, we want to keep URLs the same, so overwrite "service_name" with "service" if that's the primary label
        if (labelName === SERVICE_UI_LABEL) {
          labelName = SERVICE_NAME;
        }
        const indexScene = sceneGraph.getAncestor(this, IndexScene);
        const prevRouteMatch = indexScene.state.routeMatch;

        // The "primary" label used in the URL is no longer active, pick a new one
        if (
          !newState.filters.some(
            (f) => f.key === labelName && isOperatorInclusive(f.operator) && replaceSlash(f.value) === labelValue
          )
        ) {
          const newPrimaryLabel = newState.filters.find(
            (f) => isOperatorInclusive(f.operator) && f.value !== EMPTY_VARIABLE_VALUE
          );
          if (newPrimaryLabel) {
            const newPrimaryLabelValue = isAdHocFilterValueUserInput(newPrimaryLabel.value)
              ? replaceSlash(stripAdHocFilterUserInputPrefix(newPrimaryLabel.value))
              : replaceSlash(newPrimaryLabel.value);
            indexScene.setState({
              routeMatch: {
                ...prevRouteMatch,
                params: {
                  ...prevRouteMatch?.params,
                  labelName: newPrimaryLabel.key === SERVICE_NAME ? SERVICE_UI_LABEL : newPrimaryLabel.key,
                  // If there are a bunch of values separated by pipe, like labels that come from explore, let's truncate the value so the slug doesn't get too long
                  labelValue: newPrimaryLabelValue.split('|')[0],
                },
                url: prevRouteMatch?.url ?? '',
                path: prevRouteMatch?.path ?? '',
                isExact: prevRouteMatch?.isExact ?? true,
              },
            });

            this.resetTabCount();

            if (!breakdownLabel) {
              navigateToDrilldownPage(getDrilldownSlug(), this);
            } else {
              navigateToValueBreakdown(getDrilldownValueSlug(), breakdownLabel, this);
            }
          } else {
            this.redirectToStart();
          }
        } else if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.state.$patternsData?.runQueries();
          this.state.$detectedLabelsData?.runQueries();
          this.state.$detectedFieldsData?.runQueries();
          this.state.$logsCount?.runQueries();
        }
      })
    );
  }

  private redirectToStart() {
    // Clear ongoing queries
    this.setState({
      $data: undefined,
      $logsCount: undefined,
      body: undefined,
      $patternsData: undefined,
      $detectedLabelsData: undefined,
      $detectedFieldsData: undefined,
      patternsCount: undefined,
      labelsCount: undefined,
      fieldsCount: undefined,
      logsCount: undefined,
      totalLogsCount: undefined,
    });
    getMetadataService().setServiceSceneState(this.state);
    this._subs.unsubscribe();

    // Redirect to root with updated params, which will trigger history push back to index route, preventing empty page or empty service query bugs
    navigateToIndex();
  }

  private showVariables() {
    const levelsVar = sceneGraph.findByKeyAndType(this, LEVELS_VARIABLE_SCENE_KEY, LevelsVariableScene);
    levelsVar.setState({ visible: true });
    getFieldsAndMetadataVariable(this).setState({ hide: VariableHide.dontHide });
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
    // Hide show logs button
    const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
    showLogsButton.setState({ hidden: true });
    this.showVariables();
    this.getMetadata();
    this.resetBodyAndData();

    this.setBreakdownView();

    // Run queries on activate
    this.runQueries();

    // Query Subscriptions
    this._subs.add(this.subscribeToPatternsQuery());
    this._subs.add(this.subscribeToDetectedLabelsQuery());

    // Fields tab will update its own count, and update count when a query fails
    this._subs.add(this.subscribeToDetectedFieldsQuery(getDrilldownSlug() !== PageSlugs.fields));
    this._subs.add(this.subscribeToLogsQuery());
    this._subs.add(this.subscribeToLogsCountQuery());

    // Variable subscriptions
    this.setSubscribeToLabelsVariable();
    this._subs.add(this.subscribeToFieldsVariable());
    this._subs.add(this.subscribeToMetadataVariable());
    this._subs.add(this.subscribeToLevelsVariableChangedEvent());
    this._subs.add(this.subscribeToLevelsVariableFiltersState());
    this._subs.add(this.subscribeToDataSourceVariable());
    this._subs.add(this.subscribeToPatternsVariable());
    this._subs.add(this.subscribeToLineFiltersVariable());

    // Update query runner on manual time range change
    this._subs.add(this.subscribeToTimeRange());

    // Migrations
    migrateLineFilterV1(this);
  }

  private subscribeToPatternsVariable() {
    return getPatternsVariable(this).subscribeToState((newState, prevState) => {
      if (newState.value !== prevState.value) {
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  private subscribeToLineFiltersVariable() {
    return getLineFiltersVariable(this).subscribeToEvent(SceneVariableValueChangedEvent, () => {
      this.state.$logsCount?.runQueries();
      this.state.$detectedFieldsData?.runQueries();
    });
  }

  private subscribeToDataSourceVariable() {
    return getDataSourceVariable(this).subscribeToState(() => {
      this.redirectToStart();
    });
  }

  private resetTabCount() {
    this.setState({
      fieldsCount: undefined,
      labelsCount: undefined,
      patternsCount: undefined,
    });

    getMetadataService().setServiceSceneState(this.state);
  }

  private subscribeToFieldsVariable() {
    const fieldsVar = getFieldsVariable(this);
    return fieldsVar.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  private subscribeToMetadataVariable() {
    const metadataVar = getMetadataVariable(this);
    return metadataVar.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$detectedFieldsData?.runQueries();
        this.state.$logsCount?.runQueries();
      }
    });
  }

  /**
   * Subscribe to SceneVariableValueChangedEvent and run logs count and detectedFields on update.
   * In the levels variable renderer we update the ad-hoc filters, but we don't always want to immediately execute queries.
   */
  private subscribeToLevelsVariableChangedEvent() {
    return getLevelsVariable(this).subscribeToEvent(SceneVariableValueChangedEvent, () => {
      this.state.$detectedFieldsData?.runQueries();
    });
  }

  /**
   * Subscribe to actual filter changes and update the logs count
   * @private
   */
  private subscribeToLevelsVariableFiltersState() {
    const levelsVariable = getLevelsVariable(this);
    return levelsVariable.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.state.$logsCount?.runQueries();
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
    if (slug === PageSlugs.labels || parentSlug === ValueSlugs.label || this.state.labelsCount === undefined) {
      this.state.$detectedLabelsData?.runQueries();
    }

    // If we don't have a detected fields count, or we are activating the fields scene, run the detected fields query
    if (slug === PageSlugs.fields || parentSlug === ValueSlugs.field || this.state.fieldsCount === undefined) {
      this.state.$detectedFieldsData?.runQueries();
    }
    if (this.state.logsCount === undefined) {
      this.state.$logsCount?.runQueries();
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
          const removeSpecialFields = detectedLabelsResponse.series[0].fields.filter(
            (f) => LEVEL_VARIABLE_VALUE !== f.name
          );

          this.setState({
            labelsCount: removeSpecialFields.length + 1, // Add one for detected_level
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
    return this.state.$data?.subscribeToState((newState, prevState) => {
      this.updateLoadingState(newState, TabNames.logs);
      if (newState.data?.state === LoadingState.Done || newState.data?.state === LoadingState.Streaming) {
        const resultCount = newState.data.series[0]?.length ?? 0;
        if (resultCount !== this.state.logsCount) {
          this.setState({
            logsCount: resultCount,
          });
        }
      }
    });
  }

  private subscribeToLogsCountQuery() {
    return this.state.$logsCount?.subscribeToState((newState) => {
      if (newState.data?.state === LoadingState.Done) {
        const value: number | undefined = newState.data.series[0]?.fields?.[1]?.values?.[0];
        this.setState({
          totalLogsCount: value,
        });
      }
    });
  }

  private subscribeToDetectedFieldsQuery(updateFieldsCount: boolean) {
    return this.state.$detectedFieldsData?.subscribeToState((newState) => {
      this.updateLoadingState(newState, TabNames.fields);
      if (updateFieldsCount && newState.data?.state === LoadingState.Done) {
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
      this.state.$logsCount?.runQueries();
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

    if (!this.state.$logsCount) {
      stateUpdate.$logsCount = getLogCountQueryRunner();
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
      const err = new Error('body is not defined in setBreakdownView!');
      logger.error(err, { msg: 'ServiceScene setBreakdownView error' });
      throw err;
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
        logger.error(new Error('not setting breakdown view'), { msg: 'setBreakdownView error' });
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

function getLogCountQueryRunner() {
  const queryRunner = getQueryRunner(
    [
      buildDataQuery(`sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR}[$__auto]))`, {
        refId: LOGS_COUNT_QUERY_REFID,
        queryType: 'instant',
      }),
    ],
    { runQueriesMode: 'manual' } // for some reason when this query is set to auto, it doesn't run on time range update, looks like there is different behavior with data providers not in the special $data prop
  );

  if (queryRunner instanceof SceneQueryRunner) {
    return queryRunner;
  }
  const error = new Error('log count query provider is not query runner!');
  logger.error(error, { msg: 'getLogCountQueryRunner: invalid return type' });
  throw error;
}
