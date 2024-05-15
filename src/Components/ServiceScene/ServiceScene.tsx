import { css } from '@emotion/css';
import React from 'react';

import { DashboardCursorSync, GrafanaTheme2, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  behaviors,
  CustomVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { renderLogQLLabelFilters } from 'Components/IndexScene/IndexScene';
import { Unsubscribable } from 'rxjs';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { DetectedLabelsResponse, extractParserAndFieldsFromDataFrame } from 'services/fields';
import { getQueryRunner } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { EXPLORATIONS_ROUTE, PLUGIN_ID } from 'services/routing';
import { getExplorationFor, getLokiDatasource, getUniqueFilters } from 'services/scenes';
import {
  ALL_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from 'services/variables';
import { buildFieldsBreakdownActionScene } from './Breakdowns/FieldsBreakdownScene';
import { buildLabelBreakdownActionScene } from './Breakdowns/LabelBreakdownScene';
import { buildPatternsScene } from './Breakdowns/PatternsBreakdownScene';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { GoToExploreButton } from './GoToExploreButton';
import { buildLogsListScene } from './LogsListScene';
import { LogsVolumePanel } from './LogsVolumePanel';
import { ShareExplorationButton } from './ShareExplorationButton';

interface LokiPattern {
  pattern: string;
  samples: Array<[number, string]>;
}

export type ActionViewType = 'logs' | 'labels' | 'patterns' | 'fields';

interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  getScene: (changeFields: (f: string[]) => void) => SceneObject;
}

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ServiceSceneState extends SceneObjectState {
  body: SceneFlexLayout;
  actionView?: string;

  detectedFields?: string[];
  labels?: string[];
  patterns?: LokiPattern[];

  detectedFieldsCount?: number;
}

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS, VAR_FIELDS, VAR_PATTERNS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  public constructor(state: MakeOptional<ServiceSceneState, 'body'>) {
    super({
      body: state.body ?? buildGraphScene(),
      $variables: state.$variables,
      $data: getQueryRunner(buildLokiQuery(LOG_STREAM_SELECTOR_EXPR)),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private getFiltersVariable(): AdHocFiltersVariable {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this)!;
    if (!(variable instanceof AdHocFiltersVariable)) {
      throw new Error('Filters variable not found');
    }

    return variable;
  }

  private setEmptyFiltersRedirection() {
    const variable = this.getFiltersVariable();
    if (variable.state.filters.length === 0) {
      this.redirectToStart();
      return;
    }
    variable.subscribeToState((newState) => {
      if (newState.filters.length === 0) {
        this.redirectToStart();
      }
    });
  }

  private redirectToStart() {
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
    fields.setState({ filters: [] });
    const lineFilter = sceneGraph.lookupVariable(VAR_LINE_FILTER, this);
    if (lineFilter instanceof CustomVariable) {
      lineFilter.changeValueTo('');
    }

    // Use locationService to do the redirect and allow the users to start afresh,
    // potentially getting them unstuck of any leakage produced by subscribers, listeners,
    // variables, etc.,  without having to do a full reload.
    const params = locationService.getSearch();
    const newParams = new URLSearchParams();
    const from = params.get('from');
    if (from) {
      newParams.set('from', from);
    }
    const to = params.get('to');
    if (to) {
      newParams.set('to', to);
    }
    const ds = params.get('var-ds');
    if (ds) {
      newParams.set('var-ds', ds);
    }
    locationService.push(`${EXPLORATIONS_ROUTE}?${newParams}`);
  }

  private _onActivate() {
    if (this.state.actionView === undefined) {
      this.setActionView('logs');
    }

    const unsubs: Unsubscribable[] = [];

    this.setEmptyFiltersRedirection();

    const dataUnsub = this.state.$data?.subscribeToState(() => {
      this.updateFields();
    });
    if (dataUnsub) {
      unsubs.push(dataUnsub);
    }

    this.updateLabels();
    this.updatePatterns();

    unsubs.push(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.updateLabels();
        this.updatePatterns();
      })
    );

    return () => unsubs.forEach((u) => u.unsubscribe());
  }

  private onReferencedVariableValueChanged(variable: SceneVariable) {
    if (variable.state.name === VAR_DATASOURCE) {
      this.redirectToStart();
      return;
    }
    const filterVariable = this.getFiltersVariable();
    if (filterVariable.state.filters.length === 0) {
      return;
    }
    this.updatePatterns();
    this.updateLabels();
    locationService.partial({ actionView: 'logs' });
  }

  private getLogsFormatVariable() {
    const variable = sceneGraph.lookupVariable(VAR_LOGS_FORMAT, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Logs format variable not found');
    }
    return variable;
  }

  private updateFields() {
    const variable = this.getLogsFormatVariable();
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
    if (newState.data?.state === LoadingState.Done) {
      const frame = newState.data?.series[0];
      if (frame) {
        const res = extractParserAndFieldsFromDataFrame(frame);
        const detectedFields = res.fields.filter((f) => !disabledFields.includes(f)).sort((a, b) => a.localeCompare(b));
        if (JSON.stringify(detectedFields) !== JSON.stringify(this.state.detectedFields)) {
          this.setState({
            detectedFields,
          });
        }
        const newType = res.type ? ` | ${res.type}` : '';
        if (variable.getValue() !== newType) {
          variable.changeValueTo(newType);
        }
      }
    }
  }

  private async updatePatterns() {
    const ds = await getLokiDatasource(this);
    if (!ds) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
    const excludeLabels = [ALL_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE];

    const { data } = await ds.getResource(
      'patterns',
      {
        query: renderLogQLLabelFilters([
          // this will only be the service name for now
          ...filters.state.filters,
          // only include fields that are an indexed label
          ...fields.state.filters.filter(
            // we manually add level as a label, but it'll be structured metadata mostly, so we skip it here
            (field) => this.state.labels?.includes(field.key) && !excludeLabels.includes(field.key)
          ),
        ]),
        start: timeRange.from.utc().toISOString(),
        end: timeRange.to.utc().toISOString(),
      },
      {
        headers: {
          'X-Query-Tags': `Source=${PLUGIN_ID}`,
        },
      }
    );
    this.setState({ patterns: data });
  }

  private async updateLabels() {
    const ds = await getLokiDatasource(this);

    if (!ds) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;
    const { detectedLabels } = await ds.getResource<DetectedLabelsResponse>(
      'detected_labels',
      {
        query: filters.state.filterExpression,
        start: timeRange.from.utc().toISOString(),
        end: timeRange.to.utc().toISOString(),
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
      .filter((a) => a.cardinality > 1)
      .sort((a, b) => a.cardinality - b.cardinality)
      .map((l) => l.label);
    if (!labels.includes(LEVEL_VARIABLE_VALUE)) {
      labels.unshift(LEVEL_VARIABLE_VALUE);
    }
    if (JSON.stringify(labels) !== JSON.stringify(this.state.labels)) {
      this.setState({ labels });
    }
  }

  getUrlState() {
    return { actionView: this.state.actionView };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.actionView === 'string') {
      if (this.state.actionView !== values.actionView) {
        const actionViewDef = actionViewsDefinitions.find((v) => v.value === values.actionView);
        if (actionViewDef) {
          this.setActionView(actionViewDef.value);
        }
      }
    } else if (values.actionView === null) {
      this.setActionView(undefined);
    }
  }

  public setActionView(actionView?: ActionViewType) {
    const { body } = this.state;
    const actionViewDef = actionViewsDefinitions.find((v) => v.value === actionView);

    if (actionViewDef && actionViewDef.value !== this.state.actionView) {
      // reduce max height for main panel to reduce height flicker
      body.state.children[0].setState({ maxHeight: MAIN_PANEL_MIN_HEIGHT });
      body.setState({
        children: [
          ...body.state.children.slice(0, 2),
          actionViewDef.getScene((vals) => {
            if (actionViewDef.value === 'fields') {
              this.setState({ detectedFieldsCount: vals.length });
            }
          }),
        ],
      });
      // this is mainly to fix the logs panels height and set it to 2x the height of the log volume
      body.state.children[body.state.children.length - 1].setState({ minHeight: MAIN_PANEL_MIN_HEIGHT * 2 });
      this.setState({ actionView: actionViewDef.value });
    } else {
      // restore max height
      body.state.children[0].setState({ maxHeight: MAIN_PANEL_MAX_HEIGHT });
      body.setState({ children: body.state.children.slice(0, 2) });
      this.setState({ actionView: undefined });
    }
  }

  static Component = ({ model }: SceneComponentProps<ServiceScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

const actionViewsDefinitions: ActionViewDefinition[] = [
  { displayName: 'Logs', value: 'logs', getScene: buildLogsListScene },
  { displayName: 'Labels', value: 'labels', getScene: buildLabelBreakdownActionScene },
  { displayName: 'Detected fields', value: 'fields', getScene: buildFieldsBreakdownActionScene },
  { displayName: 'Patterns', value: 'patterns', getScene: buildPatternsScene },
];

export interface LogsActionBarState extends SceneObjectState {}

export class LogsActionBar extends SceneObjectBase<LogsActionBarState> {
  public static Component = ({ model }: SceneComponentProps<LogsActionBar>) => {
    const logsScene = sceneGraph.getAncestor(model, ServiceScene);
    const styles = useStyles2(getStyles);
    const exploration = getExplorationFor(model);
    const { actionView } = logsScene.useState();

    const getCounter = (tab: ActionViewDefinition) => {
      switch (tab.value) {
        case 'fields':
          return (
            logsScene.state.detectedFieldsCount ??
            getUniqueFilters(logsScene, logsScene.state.detectedFields || []).length
          );
        case 'patterns':
          return logsScene.state.patterns?.length;
        case 'labels':
          return getUniqueFilters(logsScene, logsScene.state.labels?.filter((l) => l !== ALL_VARIABLE_VALUE) ?? [])
            .length;
        default:
          return undefined;
      }
    };

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={2}>
            <GiveFeedbackButton />
            <ShareExplorationButton exploration={exploration} />
            <GoToExploreButton exploration={exploration} />
          </Stack>
        </div>

        <TabsBar>
          {actionViewsDefinitions.map((tab, index) => {
            return (
              <Tab
                key={index}
                label={tab.displayName}
                active={actionView === tab.value}
                counter={getCounter(tab)}
                onChangeTab={() => {
                  if (tab.value !== logsScene.state.actionView) {
                    reportAppInteraction(
                      USER_EVENTS_PAGES.service_details,
                      USER_EVENTS_ACTIONS.service_details.action_view_changed,
                      {
                        newActionView: tab.value,
                        previousActionView: logsScene.state.actionView,
                      }
                    );
                    logsScene.setActionView(tab.value);
                  }
                }}
              />
            );
          })}
        </TabsBar>
      </Box>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        zIndex: 2,
      },
    }),
  };
}

const MAIN_PANEL_MIN_HEIGHT = 200;
const MAIN_PANEL_MAX_HEIGHT = '30%';

function buildGraphScene() {
  return new SceneFlexLayout({
    direction: 'column',
    $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: new LogsVolumePanel({}),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new LogsActionBar({}),
      }),
    ],
  });
}
