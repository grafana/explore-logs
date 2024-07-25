import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  AdHocFiltersVariable,
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
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { DetectedLabel, DetectedLabelsResponse, updateParserFromDataFrame } from 'services/fields';
import { getQueryRunner } from 'services/panel';
import { buildLokiQuery, renderLogQLStreamSelector } from 'services/query';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, PLUGIN_ID, ValueSlugs } from 'services/routing';
import { getExplorationFor, getLokiDatasource } from 'services/scenes';
import {
  ALL_VARIABLE_VALUE,
  LEVEL_VARIABLE_VALUE,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_PATTERNS,
} from 'services/variables';
import {
  buildFieldsBreakdownActionScene,
  buildFieldValuesBreakdownActionScene,
} from './Breakdowns/FieldsBreakdownScene';
import { buildLabelBreakdownActionScene, buildLabelValuesBreakdownActionScene } from './Breakdowns/LabelBreakdownScene';
import { buildPatternsScene } from './Breakdowns/Patterns/PatternsBreakdownScene';
import { GoToExploreButton } from './GoToExploreButton';
import { buildLogsListScene } from './LogsListScene';
import { testIds } from 'services/testIds';
import { sortLabelsByCardinality } from 'services/filters';
import { SERVICE_NAME } from 'Components/ServiceSelectionScene/ServiceSelectionScene';
import { getMetadataService } from '../../services/metadata';
import { navigateToDrilldownPage, navigateToIndex } from '../../services/navigate';

export interface LokiPattern {
  pattern: string;
  samples: Array<[number, string]>;
}

interface BreakdownViewDefinition {
  displayName: string;
  value: PageSlugs;
  testId: string;
  getScene: (changeFields: (f: string[]) => void) => SceneObject;
}

interface ValueBreakdownViewDefinition {
  displayName: string;
  value: ValueSlugs;
  testId: string;
  getScene: (value: string) => SceneObject;
}

type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ServiceSceneCustomState {
  fields?: string[];
  labels?: DetectedLabel[];
  patterns?: LokiPattern[];
  fieldsCount?: number;
  loading?: boolean;
}

export interface ServiceSceneState extends SceneObjectState, ServiceSceneCustomState {
  body: SceneFlexLayout;
  drillDownLabel?: string;
}

export class ServiceScene extends SceneObjectBase<ServiceSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_DATASOURCE, VAR_LABELS, VAR_FIELDS, VAR_PATTERNS],
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
    const variable = sceneGraph.lookupVariable(VAR_LABELS, this)!;

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
    this.setBreakdownView();
    this.setEmptyFiltersRedirection();

    if (this.state.$data) {
      this._subs.add(
        this.state.$data?.subscribeToState((newState, prevState) => {
          if (newState.data?.state === LoadingState.Done) {
            this.updateFields();
          }
        })
      );
    }

    this.updateLabels();
    this.updatePatterns();

    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.updateLabels();
        this.updatePatterns();
      })
    );
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
    Promise.all([this.updatePatterns(), this.updateLabels()])
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
    if (newState.data?.state === LoadingState.Done) {
      const frame = newState.data?.series[0];
      if (frame) {
        const res = updateParserFromDataFrame(frame, this);
        const fields = res.fields.filter((f) => !disabledFields.includes(f)).sort((a, b) => a.localeCompare(b));
        if (JSON.stringify(fields) !== JSON.stringify(this.state.fields)) {
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
    } else if (newState.data?.state === LoadingState.Error) {
      this.setState({
        fields: [],
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
    const labels = sceneGraph.lookupVariable(VAR_LABELS, this)! as AdHocFiltersVariable;
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
    const excludeLabels = [ALL_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE];

    const { data } = await ds.getResource(
      'patterns',
      {
        query: renderLogQLStreamSelector([
          // this will only be the service name for now
          ...labels.state.filters,
          // only include fields that are an indexed label
          ...fields.state.filters.filter(
            // we manually add level as a label, but it'll be structured metadata mostly, so we skip it here
            (field) =>
              this.state.labels?.find((label) => label.label === field.key) && !excludeLabels.includes(field.key)
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
    const timeRange = sceneGraph.getTimeRange(this);

    const timeRangeValue = timeRange.state.value;
    const filters = sceneGraph.lookupVariable(VAR_LABELS, this)! as AdHocFiltersVariable;
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

    if (JSON.stringify(labels) !== JSON.stringify(this.state.labels)) {
      this.setState({ labels });
    }
  }

  public setBreakdownView() {
    const { body } = this.state;
    const breakdownView = getDrilldownSlug();
    const breakdownViewDef = breakdownViewsDefinitions.find((v) => v.value === breakdownView);

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
    return <body.Component model={body} />;
  };
}

const breakdownViewsDefinitions: BreakdownViewDefinition[] = [
  {
    displayName: 'Logs',
    value: PageSlugs.logs,
    getScene: () => buildLogsListScene(),
    testId: testIds.exploreServiceDetails.tabLogs,
  },
  {
    displayName: 'Labels',
    value: PageSlugs.labels,
    getScene: () => buildLabelBreakdownActionScene(),
    testId: testIds.exploreServiceDetails.tabLabels,
  },
  {
    displayName: 'Fields',
    value: PageSlugs.fields,
    getScene: (f) => buildFieldsBreakdownActionScene(f),
    testId: testIds.exploreServiceDetails.tabFields,
  },
  {
    displayName: 'Patterns',
    value: PageSlugs.patterns,
    getScene: () => buildPatternsScene(),
    testId: testIds.exploreServiceDetails.tabPatterns,
  },
];

const valueBreakdownViews: ValueBreakdownViewDefinition[] = [
  {
    displayName: 'Label',
    value: ValueSlugs.label,
    getScene: (value: string) => buildLabelValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabLabels,
  },
  {
    displayName: 'Field',
    value: ValueSlugs.field,
    getScene: (value: string) => buildFieldValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabFields,
  },
];

export interface LogsActionBarState extends SceneObjectState {}

export class LogsActionBar extends SceneObjectBase<LogsActionBarState> {
  public static Component = ({ model }: SceneComponentProps<LogsActionBar>) => {
    const styles = useStyles2(getStyles);
    const exploration = getExplorationFor(model);
    let currentBreakdownViewSlug = getDrilldownSlug();
    let allowNavToParent = false;

    if (!Object.values(PageSlugs).includes(currentBreakdownViewSlug)) {
      const drilldownValueSlug = getDrilldownValueSlug();
      allowNavToParent = true;
      if (drilldownValueSlug === ValueSlugs.field) {
        currentBreakdownViewSlug = PageSlugs.fields;
      }
      if (drilldownValueSlug === ValueSlugs.label) {
        currentBreakdownViewSlug = PageSlugs.labels;
      }
    }

    const getCounter = (tab: BreakdownViewDefinition, state: ServiceSceneState) => {
      switch (tab.value) {
        case 'fields':
          return state.fieldsCount ?? (state.fields?.filter((l) => l !== ALL_VARIABLE_VALUE) ?? []).length;
        case 'patterns':
          return state.patterns?.length;
        case 'labels':
          return (state.labels?.filter((l) => l.label !== ALL_VARIABLE_VALUE) ?? []).length;
        default:
          return undefined;
      }
    };

    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { loading, ...state } = serviceScene.useState();
    return (
      <Box paddingY={0}>
        <div className={styles.actions}>
          <Stack gap={1}>
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
                counter={!loading ? getCounter(tab, state) : undefined}
                icon={loading ? 'spinner' : undefined}
                onChangeTab={() => {
                  if (tab.value !== currentBreakdownViewSlug || allowNavToParent) {
                    reportAppInteraction(
                      USER_EVENTS_PAGES.service_details,
                      USER_EVENTS_ACTIONS.service_details.action_view_changed,
                      {
                        newActionView: tab.value,
                        previousActionView: currentBreakdownViewSlug,
                      }
                    );
                    if (tab.value) {
                      const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
                      const variable = serviceScene.getFiltersVariable();
                      const service = variable.state.filters.find((f) => f.key === SERVICE_NAME);

                      if (service?.value) {
                        navigateToDrilldownPage(tab.value, serviceScene);
                      } else {
                        navigateToIndex();
                      }
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
