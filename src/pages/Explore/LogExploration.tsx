import {css} from '@emotion/css';
import React from 'react';

import {AdHocVariableFilter, GrafanaTheme2} from '@grafana/data';
import {locationService} from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  getUrlSyncManager,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneFlexItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  SplitLayout,
  VariableValueSelectors,
} from '@grafana/scenes';
import {Tag, useStyles2} from '@grafana/ui';

import {LogsByServiceScene} from '../../components/Explore/LogsByService/LogsByServiceScene';
import {SelectStartingPointScene} from './SelectStartingPointScene';
import {
  DetailsSceneUpdated,
  explorationDS,
  StartingPointSelectedEvent,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_PATTERNS,
} from '../../utils/shared';
import {DetailsScene} from '../../components/Explore/LogsByService/DetailsScene';
import {AppliedPattern} from '../../components/Explore/types';
import {VariableHide} from '@grafana/schema';
import {LiveTailControl} from 'components/Explore/LiveTailControl';

type LogExplorationMode = 'start' | 'logs';

export interface LogExplorationState extends SceneObjectState {
  topScene?: SceneObject;
  controls: SceneObject[];
  // history: ExplorationHistory;
  body: SplitLayout;

  mode?: LogExplorationMode;
  detailsScene?: DetailsScene;
  showDetails?: boolean;

  // just for the starting data source
  initialDS?: string;
  initialFilters?: AdHocVariableFilter[];

  patterns?: AppliedPattern[];
}

export class LogExploration extends SceneObjectBase<LogExplorationState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['mode', 'patterns'] });

  public constructor(state: Partial<LogExplorationState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? getVariableSet(state.initialDS, state.initialFilters),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
        new LiveTailControl({}),
      ],
      body: buildSplitLayout(),
      detailsScene: new DetailsScene({}),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public _onActivate() {
    if (!this.state.topScene) {
      this.setState({ topScene: getTopScene(this.state.mode) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(StartingPointSelectedEvent, this._handleStartingPointSelected.bind(this));
    this.subscribeToEvent(DetailsSceneUpdated, this._handleDetailsSceneUpdated.bind(this));

    this.subscribeToState((newState, oldState) => {
      if (newState.showDetails !== oldState.showDetails) {
        if (newState.showDetails) {
          this.state.body.setState({ secondary: new DetailsScene(this.state.detailsScene?.state || {}) });
          this.setState({ detailsScene: undefined });
        } else {
          this.state.body.setState({ secondary: undefined });
          this.setState({ detailsScene: new DetailsScene({}) });
        }
      }

      const patternsVariable = sceneGraph.lookupVariable(VAR_PATTERNS, this);
      if (patternsVariable instanceof CustomVariable) {
        const patternsLine =
          newState.patterns
            ?.map(
              (p) =>
                `${p.type === 'include' ? '|~ ' : '!~ '} \`${p.pattern.replace(/<\*>/g, '.*').replace(/\+/g, '\\+')}\``
            )
            ?.join(' ') || '|= ``';
        patternsVariable.changeValueTo(patternsLine);
      }
    });

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  private _handleStartingPointSelected(evt: StartingPointSelectedEvent) {
    locationService.partial({ mode: 'logs' });
  }

  private _handleDetailsSceneUpdated(evt: DetailsSceneUpdated) {
    this.setState({ showDetails: true });
  }

  getUrlState() {
    return { mode: this.state.mode, patterns: JSON.stringify(this.state.patterns) };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogExplorationState> = {};

    if (values.mode !== this.state.mode) {
      const mode: LogExplorationMode = (values.mode as LogExplorationMode) ?? 'start';
      stateUpdate.mode = mode;
      stateUpdate.topScene = getTopScene(mode);
    }

    if (values.patterns && typeof values.patterns === 'string') {
      stateUpdate.patterns = JSON.parse(values.patterns) as AppliedPattern[];
    }

    this.setState(stateUpdate);
  }

  static Component = ({ model }: SceneComponentProps<LogExploration>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    return <div className={styles.bodyContainer}> {body && <body.Component model={body} />} </div>;
  };
}

export class LogExplorationScene extends SceneObjectBase {
  static Component = ({ model }: SceneComponentProps<LogExplorationScene>) => {
    const logExploration = sceneGraph.getAncestor(model, LogExploration);
    const { controls, topScene, mode, patterns } = logExploration.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        {controls && (
          <div className={styles.controls}>
            {controls.map((control) => (
              <control.Component key={control.state.key} model={control} />
            ))}
          </div>
        )}
        {mode === 'logs' && (
          <div className={styles.patterns}>
            <span>Patterns:</span>
            {patterns?.length ? (
              patterns.map((p) => (
                <Tag
                  key={p.pattern}
                  name={p.pattern}
                  colorIndex={p.type === 'include' ? 6 : 8}
                  onClick={() => logExploration.setState({ patterns: patterns?.filter((pat) => pat !== p) || [] })}
                />
              ))
            ) : (
              <i>No patterns applied</i>
            )}
          </div>
        )}
        <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
      </div>
    );
  };
}

function buildSplitLayout() {
  return new SplitLayout({
    direction: 'row',
    initialSize: 0.6,
    primary: new SceneFlexItem({
      body: new LogExplorationScene({}),
    }),
  });
}

function getTopScene(mode?: LogExplorationMode) {
  if (mode === 'logs') {
    return new LogsByServiceScene({});
  }
  return new SelectStartingPointScene({});
}

function getVariableSet(initialDS?: string, initialFilters?: AdHocVariableFilter[]) {
  return new SceneVariableSet({
    variables: [
      new DataSourceVariable({
        name: VAR_DATASOURCE,
        label: 'Data source',
        value: initialDS,
        pluginId: 'loki',
      }),
      new AdHocFiltersVariable({
        name: VAR_FILTERS,
        datasource: explorationDS,
        layout: 'horizontal',
        label: 'Labels',
        filters: initialFilters ?? [],
        expressionBuilder: renderLogQLLabelFilters,
      }),
      new AdHocFiltersVariable({
        name: VAR_FIELDS,
        label: 'Fields',
        applyMode: 'manual',
        getTagKeysProvider: () => Promise.resolve({ values: [] }),
        getTagValuesProvider: () => Promise.resolve({ values: [] }),
        expressionBuilder: renderLogQLFieldFilters,
      }),
      new CustomVariable({
        name: VAR_PATTERNS,
        value: '|= ``',
        hide: VariableHide.hideVariable,
      }),
    ],
  });
}

export function renderLogQLLabelFilters(filters: AdHocVariableFilter[]) {
  return '{' + filters.map((filter) => renderFilter(filter)).join(', ') + '}';
}

export function renderLogQLFieldFilters(filters: AdHocVariableFilter[]) {
  return filters.map((filter) => `| ${renderFilter(filter)}`).join(' ');
}

function renderFilter(filter: AdHocVariableFilter) {
  return `${filter.key}${filter.operator}\`${filter.value}\``;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    bodyContainer: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    container: css({
      flexGrow: 1,
      display: 'flex',
      gap: theme.spacing(2),
      minHeight: '100%',
      flexDirection: 'column',
      padding: theme.spacing(2),
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(2),
      alignItems: 'flex-end',
      flexWrap: 'wrap',
    }),
    rotateIcon: css({
      svg: { transform: 'rotate(180deg)' },
    }),
    patterns: css({
      display: 'flex',
      gap: theme.spacing(1),
      alignItems: 'center',
    }),
  };
}
