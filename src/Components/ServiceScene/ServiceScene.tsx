import React from 'react';

import { AdHocVariableFilter, LoadingState, PanelData } from '@grafana/data';
import {
  SceneComponentProps,
  SceneDataProvider,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneVariableState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { LoadingPlaceholder } from '@grafana/ui';
import { updateParserFromDataFrame } from 'services/fields';
import { getQueryRunner, getResourceQueryRunner } from 'services/panel';
import { buildDataQuery, buildResourceQuery } from 'services/query';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, ValueSlugs } from 'services/routing';
import {
  getDataSourceVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LABELS_EXPR,
  VAR_LEVELS,
  VAR_PATTERNS,
} from 'services/variables';
import { SERVICE_NAME } from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import { getMetadataService } from '../../services/metadata';
import { navigateToDrilldownPage, navigateToIndex } from '../../services/navigate';
import { areArraysEqual } from '../../services/comparison';
import { ActionBarScene } from './ActionBarScene';
import { breakdownViewsDefinitions, valueBreakdownViews } from './BreakdownViews';

const LOGS_PANEL_QUERY_REFID = 'logsPanelQuery';
const PATTERNS_QUERY_REFID = 'patterns';
const DETECTED_LABELS_QUERY_REFID = 'detectedLabels';

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ServiceSceneCustomState {
  fields?: string[];
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
}

export function getLogsPanelFrame(data: PanelData | undefined) {
  return data?.series.find((series) => series.refId === LOGS_PANEL_QUERY_REFID);
}

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS, VAR_LEVELS],
    // onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  public constructor(
    state: MakeOptional<ServiceSceneState, 'body' | '$data' | '$patternsData' | '$detectedLabelsData'>
  ) {
    super({
      loading: true,
      body: state.body ?? buildGraphScene(),
      $data: getServiceSceneQueryRunner(),
      $patternsData: getPatternsQueryRunner(),
      $detectedLabelsData: getDetectedLabelsQueryRunner(),
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
      $detectedLabelsData: undefined,
      patternsCount: undefined,
      labelsCount: undefined,
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

    // Run queries on activate
    this.runQueries();

    // Query Subscriptions
    this._subs.add(this.subscribeToData());
    this._subs.add(this.subscribeToPatternsQuery());
    this._subs.add(this.subscribeToDetectedLabelsQuery());

    // Variable subscriptions
    this._subs.add(this.subscribeToLabelsVariable());
    this._subs.add(this.subscribeToFields());
    this._subs.add(this.subscribeToLevels());
    this._subs.add(this.subscribeToDataSourceVariable());

    // Update query runner on manual time range change
    this._subs.add(this.subscribeToTimeRange());
  }

  private subscribeToDataSourceVariable() {
    return getDataSourceVariable(this).subscribeToState(() => {
      this.redirectToStart();
    });
  }

  private subscribeToLevels() {
    return getLevelsVariable(this).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.navigateOnAdHocVariableChange(newState, prevState);
      }
    });
  }

  private subscribeToFields() {
    return getFieldsVariable(this).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        this.navigateOnAdHocVariableChange(newState, prevState);
      }
    });
  }

  private subscribeToLabelsVariable() {
    return getLabelsVariable(this).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        // We want to update the counts
        this.state.$patternsData?.runQueries();
        this.state.$detectedLabelsData?.runQueries();
        this.navigateOnAdHocVariableChange(newState, prevState);
      }
    });
  }

  /**
   * Navigate when the user adds a positive filter to the ad hoc filter variables
   * Note: AdHocFilterVariableState is not currently exported from scenes.
   * @param newState
   * @param prevState
   * @private
   */
  private navigateOnAdHocVariableChange(
    newState: SceneVariableState & { filters: AdHocVariableFilter[] },
    prevState: SceneVariableState & { filters: AdHocVariableFilter[] }
  ) {
    const lastFilter = newState.filters[newState.filters.length - 1];
    if (newState.filters.length > prevState.filters.length) {
      // User added a filter

      if (lastFilter.operator === '=') {
        navigateToDrilldownPage(PageSlugs.logs, this);
      }
    } else if (newState.filters.length === prevState.filters.length) {
      // user modified a filter
      // Do we want to move folks that change the service name?
      if (lastFilter.operator === '=' && lastFilter.key !== SERVICE_NAME) {
        navigateToDrilldownPage(PageSlugs.logs, this);
      }
    }
  }

  private runQueries() {
    const slug = getDrilldownSlug();
    const parentSlug = getDrilldownValueSlug();

    // If we don't have a patterns count in the tabs, or we are activating the patterns scene, run the pattern query
    if (slug === PageSlugs.patterns || this.state.patternsCount === undefined) {
      this.state.$patternsData?.runQueries();
    }

    // If we don't have a detected labels count, or we are activating the labels scene, run the detected labels query
    // @todo we don't need to re-query detected_labels when selecting an individual value (navigating from labels -> label) as nothing in the query has changed, but scenes forces us to as each route has its own instantiation of this class. We could put the labels on the metadata service?
    if (
      ((slug === PageSlugs.labels || parentSlug === ValueSlugs.label) && !this.state.$detectedLabelsData?.state.data) ||
      this.state.labelsCount === undefined
    ) {
      this.state.$detectedLabelsData?.runQueries();
    }
  }

  private subscribeToData() {
    return this.state.$data?.subscribeToState((newState) => {
      if (newState.data?.state === LoadingState.Done) {
        const logsPanelResponse = getLogsPanelFrame(newState.data);
        if (logsPanelResponse) {
          this.updateFields();
        }
      }
    });
  }

  private subscribeToPatternsQuery() {
    return this.state.$patternsData?.subscribeToState((newState) => {
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
      if (newState.data?.state === LoadingState.Done) {
        const detectedLabelsResponse = newState.data;
        // Detected labels API call always returns a single frame, with a field for each label
        const detectedLabelsFields = detectedLabelsResponse.series[0].fields;
        if (detectedLabelsResponse.series.length !== undefined && detectedLabelsFields.length !== undefined) {
          this.setState({
            labelsCount: detectedLabelsFields.length,
          });
          getMetadataService().setLabelsCount(detectedLabelsFields.length);
        }
      }
    });
  }

  private subscribeToTimeRange() {
    return sceneGraph.getTimeRange(this).subscribeToState(() => {
      this.state.$patternsData?.runQueries();
      this.state.$detectedLabelsData?.runQueries();
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

    if (!this.state.body) {
      stateUpdate.body = buildGraphScene();
    }

    if (Object.keys(stateUpdate).length) {
      this.setState(stateUpdate);
    }
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
        body: new ActionBarScene({}),
      }),
    ],
  });
}

function getPatternsQueryRunner() {
  return getResourceQueryRunner([buildResourceQuery(VAR_LABELS_EXPR, 'patterns', { refId: PATTERNS_QUERY_REFID })]);
}

function getDetectedLabelsQueryRunner() {
  return getResourceQueryRunner([
    buildResourceQuery(VAR_LABELS_EXPR, 'detected_labels', { refId: DETECTED_LABELS_QUERY_REFID }),
  ]);
}

function getServiceSceneQueryRunner() {
  return getQueryRunner([buildDataQuery(LOG_STREAM_SELECTOR_EXPR, { refId: LOGS_PANEL_QUERY_REFID })]);
}
