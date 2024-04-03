import { css } from '@emotion/css';
import React from 'react';

import { DashboardCursorSync, GrafanaTheme2, LoadingState } from '@grafana/data';
import {
  AdHocFiltersVariable,
  behaviors,
  CustomVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneQueryRunner,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';

import { LogTimeSeriesPanel } from './LogTimeSeriesPanel';
import { buildLogsListScene } from './Tabs/LogsListScene';
import {
  ActionViewDefinition,
  ActionViewType,
  MakeOptional,
  explorationDS,
  VAR_FILTERS,
  VAR_FIELDS,
  VAR_PATTERNS,
  VAR_LOGS_FORMAT,
  LOG_STREAM_SELECTOR_EXPR,
  VAR_DATASOURCE_EXPR,
  EXPLORATIONS_ROUTE,
} from '../../../utils/shared';
import { getDatasource, getExplorationFor } from '../../../utils/utils';
import { ShareExplorationButton } from './ShareExplorationButton';
import { buildLabelBreakdownActionScene } from './Tabs/LabelBreakdownScene';
import { DataSourceWithBackend, getDataSourceSrv, locationService } from '@grafana/runtime';
import { buildPatternsScene } from './Tabs/PatternsScene';
import { buildFieldsBreakdownActionScene } from './Tabs/FieldsBreakdownScene';
import { Unsubscribable } from 'rxjs';
import { getLiveTailControl } from 'utils/scenes';
import { extractFields } from '../../../utils/fields';
import { GoToExploreButton } from './GoToExploreButton';
import { GiveFeedback } from './GiveFeedback';
import { renderLogQLLabelFilters } from 'pages/Explore';
import { DetectedLabelsResponse } from '../types';

interface LokiPattern {
  pattern: string;
  samples: Array<[number, string]>;
}

export interface LogSceneState extends SceneObjectState {
  body: SceneFlexLayout;
  actionView?: string;

  detectedFields?: string[];
  labels?: string[];
  patterns?: LokiPattern[];

  detectedFieldsCount?: number;
}

export class LogsByServiceScene extends SceneObjectBase<LogSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['actionView'] });
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_FILTERS, VAR_FIELDS, VAR_PATTERNS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  public constructor(state: MakeOptional<LogSceneState, 'body'>) {
    super({
      body: state.body ?? buildGraphScene(),
      $variables:
        state.$variables ??
        new SceneVariableSet({ variables: [new CustomVariable({ name: VAR_LOGS_FORMAT, value: '' })] }),
      $data: new SceneQueryRunner({
        datasource: explorationDS,
        queries: [buildQuery()],
      }),
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
    locationService.push(EXPLORATIONS_ROUTE);
  }

  private _onActivate() {
    if (this.state.actionView === undefined) {
      this.setActionView('logs');
    }
    if (getLiveTailControl(this)?.state.liveStreaming) {
      (this.state.$data as SceneQueryRunner).setState({ liveStreaming: true });
    }
    const unsubs: Unsubscribable[] = [];
    const liveTailControl = getLiveTailControl(this);
    if (liveTailControl) {
      unsubs.push(
        liveTailControl.subscribeToState(({ liveStreaming }) => {
          const runner = this.state.$data as SceneQueryRunner;
          runner.setState({ liveStreaming });
          runner.runQueries();
        })
      );
    }

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

  private onReferencedVariableValueChanged() {
    const variable = this.getFiltersVariable();
    if (variable.state.filters.length === 0) {
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
        const res = extractFields(frame);
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
    const ds = (await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this } })) as
      | DataSourceWithBackend
      | undefined;

    if (!ds || !ds.getResource) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;

    ds.getResource('patterns', {
      query: renderLogQLLabelFilters([
        // this will only be the service name for now
        ...filters.state.filters,
        // only include fields that are an indexed label
        ...fields.state.filters.filter((field) => this.state.labels?.includes(field.key)),
      ]),
      from: timeRange.from.utc().toISOString(),
      to: timeRange.to.utc().toISOString(),
    }).then(({ data }: { data: LokiPattern[] }) => {
      this.setState({ patterns: data });
    });
  }

  private async updateLabels() {
    const ds = await getDatasource(this);

    if (!ds) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;
    const { detectedLabels } = await ds.getResource<DetectedLabelsResponse>('detected_labels', {
      query: filters.state.filterExpression,
      start: timeRange.from.utc().toDate().getTime() * 1000,
      end: timeRange.to.utc().toDate().getTime() * 1000,
    });

    if (!detectedLabels || !Array.isArray(detectedLabels)) {
      return;
    }

    const labels = detectedLabels.filter((a) => a.cardinality > 1).sort((a, b) => b.cardinality - a.cardinality).map((l) => l.label);
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

  static Component = ({ model }: SceneComponentProps<LogsByServiceScene>) => {
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
    const logsScene = sceneGraph.getAncestor(model, LogsByServiceScene);
    const styles = useStyles2(getStyles);
    const exploration = getExplorationFor(model);
    const { actionView } = logsScene.useState();

    const getCounter = (tab: ActionViewDefinition) => {
      switch (tab.value) {
        case 'fields':
          return logsScene.state.detectedFieldsCount ?? logsScene.state.detectedFields?.length;
        case 'patterns':
          return logsScene.state.patterns?.length;
        case 'labels':
          return logsScene.state.labels?.length;
        default:
          return undefined;
      }
    };

    return (
      <Box paddingY={1}>
        <div className={styles.actions}>
          <Stack gap={2}>
            <GiveFeedback />
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

function buildQuery() {
  return {
    refId: 'A',
    expr: LOG_STREAM_SELECTOR_EXPR,
    queryType: 'range',
    editorMode: 'code',
    maxLines: 1000,
  };
}

function buildGraphScene() {
  return new SceneFlexLayout({
    direction: 'column',
    $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: new LogTimeSeriesPanel({}),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new LogsActionBar({}),
      }),
    ],
  });
}
