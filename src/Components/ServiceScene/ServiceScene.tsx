import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  CustomVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
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
import { buildBreakdownUrl, buildServicesUrl, PLUGIN_ID, ROUTES, SLUGS } from 'services/routing';
import { getExplorationFor, getLokiDatasource } from 'services/scenes';
import {
  ALL_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from 'services/variables';
import { buildFieldsBreakdownActionScene } from './Breakdowns/FieldsBreakdownScene';
import { buildLabelBreakdownActionScene } from './Breakdowns/LabelBreakdownScene';
import { buildPatternsScene } from './Breakdowns/PatternsBreakdownScene';
import { GoToExploreButton } from './GoToExploreButton';
import { buildLogsListScene } from './LogsListScene';
import { testIds } from 'services/testIds';
import { PageScene } from './PageScene';
import { sortLabelsByCardinality } from 'services/filters';
import { SERVICE_NAME } from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import { getSlug } from '../Pages';

export interface LokiPattern {
  pattern: string;
  samples: Array<[number, string]>;
}

interface BreakdownViewDefinition {
  displayName: string;
  value: SLUGS;
  testId: string;
  getScene: (changeFields: (f: string[]) => void) => SceneObject;
}

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ServiceSceneState extends SceneObjectState {
  body: SceneFlexLayout;

  detectedFields?: string[];
  labels?: string[];
  patterns?: LokiPattern[];

  detectedFieldsCount?: number;

  loading?: boolean;
}

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_FILTERS, VAR_FIELDS, VAR_PATTERNS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  public constructor(state: MakeOptional<ServiceSceneState, 'body'>) {
    super({
      body: state.body ?? buildGraphScene(),
      $data: getQueryRunner(buildLokiQuery(LOG_STREAM_SELECTOR_EXPR)),
      loading: true,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public getFiltersVariable(): AdHocFiltersVariable {
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
      // If we remove the service name filter, we should redirect to the start
      if (!newState.filters.some((f) => f.key === SERVICE_NAME)) {
        this.redirectToStart();
      }
    });
  }

  private redirectToStart() {
    // Redirect to root with updated params, which will trigger history push back to index route, preventing empty page or empty service query bugs
    locationService.replace(buildServicesUrl(ROUTES.explore()));
  }

  private onActivate() {
    this.setBreakdownView(getSlug());
    this.setEmptyFiltersRedirection();

    const unsubs: Unsubscribable[] = [];
    if (this.state.$data) {
      unsubs.push(
        this.state.$data?.subscribeToState(() => {
          this.updateFields();
        })
      );
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
    // For patterns, we don't want to reload to logs as we allow users to select multiple patterns
    if (variable.state.name !== VAR_PATTERNS) {
      locationService.push(buildBreakdownUrl(SLUGS.logs));
    }
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
            loading: false,
          });
        }
        const newType = res.type ? ` | ${res.type}` : '';
        if (variable.getValue() !== newType) {
          variable.changeValueTo(newType);
        }
      } else {
        this.setState({
          detectedFields: [],
          loading: false,
        });
      }
    } else if (newState.data?.state === LoadingState.Error) {
      this.setState({
        detectedFields: [],
        loading: false,
      });
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

    const labels = detectedLabels.sort((a, b) => sortLabelsByCardinality(a, b)).map((l) => l.label);
    if (!labels.includes(LEVEL_VARIABLE_VALUE)) {
      labels.unshift(LEVEL_VARIABLE_VALUE);
    }
    if (JSON.stringify(labels) !== JSON.stringify(this.state.labels)) {
      this.setState({ labels });
    }
  }

  public setBreakdownView(breakdownView?: SLUGS) {
    const { body } = this.state;
    const breakdownViewDef = breakdownViewsDefinitions.find((v) => v.value === breakdownView);

    if (breakdownViewDef) {
      body.setState({
        children: [
          ...body.state.children.slice(0, 1),
          breakdownViewDef.getScene((vals) => {
            if (breakdownViewDef.value === 'fields') {
              this.setState({ detectedFieldsCount: vals.length });
            }
          }),
        ],
      });
    } else {
      console.error('not setting breakdown view');
    }
  }

  static Component = ({ model }: SceneComponentProps<ServiceScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

const breakdownViewsDefinitions: BreakdownViewDefinition[] = [
  {
    displayName: 'Logs',
    value: SLUGS.logs,
    getScene: () => new PageScene({ body: buildLogsListScene(), title: 'Logs' }),
    testId: testIds.exploreServiceDetails.tabLogs,
  },
  {
    displayName: 'Labels',
    value: SLUGS.labels,
    getScene: () => new PageScene({ body: buildLabelBreakdownActionScene(), title: 'Labels' }),
    testId: testIds.exploreServiceDetails.tabLabels,
  },
  {
    displayName: 'Detected fields',
    value: SLUGS.fields,
    getScene: (f) => new PageScene({ body: buildFieldsBreakdownActionScene(f), title: 'Detected fields' }),
    testId: testIds.exploreServiceDetails.tabDetectedFields,
  },
  {
    displayName: 'Patterns',
    value: SLUGS.patterns,
    getScene: () => new PageScene({ body: buildPatternsScene(), title: 'Patterns' }),
    testId: testIds.exploreServiceDetails.tabPatterns,
  },
];

export interface LogsActionBarState extends SceneObjectState {}

export class LogsActionBar extends SceneObjectBase<LogsActionBarState> {
  public static Component = ({ model }: SceneComponentProps<LogsActionBar>) => {
    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
    const styles = useStyles2(getStyles);
    const exploration = getExplorationFor(model);
    const currentBreakdownViewSlug = getSlug();

    const getCounter = (tab: BreakdownViewDefinition) => {
      switch (tab.value) {
        case 'fields':
          return (
            serviceScene.state.detectedFieldsCount ??
            (serviceScene.state.detectedFields?.filter((l) => l !== ALL_VARIABLE_VALUE) ?? []).length
          );
        case 'patterns':
          return serviceScene.state.patterns?.length;
        case 'labels':
          return (serviceScene.state.labels?.filter((l) => l !== ALL_VARIABLE_VALUE) ?? []).length;
        default:
          return undefined;
      }
    };

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={2}>
            <GoToExploreButton exploration={exploration} />
          </Stack>
        </div>

        <TabsBar>
          {breakdownViewsDefinitions.map((tab, index) => {
            return (
              <Tab
                data-testid={tab.testId}
                key={index}
                label={tab.displayName}
                active={currentBreakdownViewSlug === tab.value}
                counter={getCounter(tab)}
                onChangeTab={() => {
                  if (tab.value !== currentBreakdownViewSlug) {
                    reportAppInteraction(
                      USER_EVENTS_PAGES.service_details,
                      USER_EVENTS_ACTIONS.service_details.action_view_changed,
                      {
                        newActionView: tab.value,
                        previousActionView: currentBreakdownViewSlug,
                      }
                    );
                    if (tab.value) {
                      // @todo Should we get the service from the url instead of the state?
                      const variable = serviceScene.getFiltersVariable();
                      const service = variable.state.filters.find((f) => f.key === SERVICE_NAME);

                      if (service?.value) {
                        const url = buildBreakdownUrl(ROUTES[tab.value](service?.value));
                        locationService.push(url);
                      } else {
                        console.error('failed to build url');
                      }
                    } else {
                      console.error('failed to navigate');
                    }
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

function buildGraphScene() {
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      new SceneFlexItem({
        ySizing: 'content',
        body: new LogsActionBar({}),
      }),
    ],
  });
}
