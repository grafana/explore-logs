import { css } from '@emotion/css';
import React from 'react';

import { DashboardCursorSync, GrafanaTheme2, LoadingState, MetricFindValue } from '@grafana/data';
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
} from '../../../utils/shared';
import { getExplorationFor, getLabelOptions, getSeriesOptions } from '../../../utils/utils';
import { ShareExplorationButton } from './ShareExplorationButton';
import { buildLabelBreakdownActionScene } from './Tabs/LabelBreakdownScene';
import { getDataSourceSrv, locationService } from '@grafana/runtime';
import { buildPatternsScene } from './Tabs/PatternsScene';
import { buildFieldsBreakdownActionScene } from './Tabs/FieldsBreakdownScene';
import { Unsubscribable } from 'rxjs';
import { getLiveTailControl } from 'utils/scenes';
import { extractFields } from '../../../utils/fields';
import { GoToExploreButton } from './GoToExploreButton';
import { GiveFeedback } from './GiveFeedback';

interface LokiPattern {
  matches: number;
  name: string;
  pattern: string;
  sampleLogLines: string[];
  volumeTimeSeries: Array<[number, string]>;
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
        this.updatePatterns();
      })
    );

    return () => unsubs.forEach((u) => u.unsubscribe());
  }

  private onReferencedVariableValueChanged() {
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
        if (detectedFields !== this.state.detectedFields) {
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
    const ds = await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this } });

    if (!ds) {
      return;
    }

    const variable = sceneGraph.lookupVariable('filters', this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    const service = variable.state.filters.find((filter) => filter.key === 'service_name')?.value || 'payment';
    if (!service) {
      return;
    }
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    // @ts-ignore
    ds.getResource!('patterns', {
      query: `{service_name="${service}"}`,
      from: timeRange.from.utc().toISOString(),
      to: timeRange.to.utc().toISOString(),
      minMatches: 50,
    }).then(({ patterns }: { patterns: LokiPattern[] }) => {
      this.setState({ patterns });
    });
  }

  private async updateLabels() {
    const ds = await getDataSourceSrv().get(VAR_DATASOURCE_EXPR, { __sceneObject: { value: this } });

    if (!ds) {
      return;
    }
    const lokiLanguageProvider = ds.languageProvider as any;
    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_FILTERS, this)! as AdHocFiltersVariable;

    lokiLanguageProvider
      .fetchSeriesLabels(filters.state.filterExpression, { timeRange })
      .then((tagKeys: Record<string, string[]>) => {
        const labels = getSeriesOptions(this, tagKeys)
          .filter((l) => l.label !== 'All')
          .map((l) => l.value!);
        if (labels !== this.state.labels) {
          this.setState({ labels });
        }
      });
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
                onChangeTab={() => logsScene.setActionView(tab.value)}
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
