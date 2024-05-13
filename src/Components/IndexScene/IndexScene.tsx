import { css } from '@emotion/css';
import React from 'react';

import { AdHocVariableFilter, GrafanaTheme2, SelectableValue, VariableHide } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  getUrlSyncManager,
  sceneGraph,
} from '@grafana/scenes';
import { Badge, useStyles2 } from '@grafana/ui';
import {
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_LINE_FILTER,
  VAR_PATTERNS,
  explorationDS,
} from 'services/variables';

import { ServiceScene } from '../ServiceScene/ServiceScene';
import { ServiceSelectionComponent, StartingPointSelectedEvent } from '../ServiceSelectionScene/ServiceSelectionScene';
import { PatternControls } from './PatternControls';
import { addLastUsedDataSourceToStorage, getLastUsedDataSourceFromStorage } from 'services/store';

type LogExplorationMode = 'start' | 'logs';

export interface AppliedPattern {
  pattern: string;
  type: 'include' | 'exclude';
}

export interface IndexSceneState extends SceneObjectState {
  // topScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  topScene?: SceneObject;
  controls: SceneObject[];
  body: LogExplorationScene;
  // mode is the current mode of the index scene - it can be either 'start' for service selection or 'logs' for service
  mode?: LogExplorationMode;
  initialFilters?: AdHocVariableFilter[];
  initialDS?: string;
  patterns?: AppliedPattern[];
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['mode', 'patterns'] });

  public constructor(state: Partial<IndexSceneState>) {
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables:
        state.$variables ?? getVariableSet(state.initialDS ?? getLastUsedDataSourceFromStorage(), state.initialFilters),
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      body: new LogExplorationScene({}),
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<IndexScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getStyles);

    return <div className={styles.bodyContainer}> {body && <body.Component model={body} />} </div>;
  };

  public _onActivate() {
    if (!this.state.topScene) {
      this.setState({ topScene: getTopScene(this.state.mode) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(StartingPointSelectedEvent, this._handleStartingPointSelected.bind(this));

    this.subscribeToState((newState, oldState) => {
      if (newState.mode !== oldState.mode) {
        this.setState({ topScene: getTopScene(newState.mode) });
      }

      const patternsVariable = sceneGraph.lookupVariable(VAR_PATTERNS, this);
      if (patternsVariable instanceof CustomVariable) {
        const patternsLine =
          newState.patterns?.map((p) => `${p.type === 'include' ? '|> ' : '!> '} \`${p.pattern}\``)?.join(' ') || '';
        patternsVariable.changeValueTo(patternsLine);
      }
    });

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  getUrlState() {
    return {
      mode: this.state.mode,
      patterns: this.state.mode === 'start' ? '' : JSON.stringify(this.state.patterns),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<IndexSceneState> = {};
    if (values.mode !== this.state.mode) {
      const mode: LogExplorationMode = (values.mode as LogExplorationMode) ?? 'start';
      stateUpdate.mode = mode;
      stateUpdate.topScene = getTopScene(mode);
    }
    if (this.state.mode === 'start') {
      // Clear patterns on start
      stateUpdate.patterns = undefined;
    } else if (values.patterns && typeof values.patterns === 'string') {
      stateUpdate.patterns = JSON.parse(values.patterns) as AppliedPattern[];
    }
    this.setState(stateUpdate);
  }

  private _handleStartingPointSelected(evt: StartingPointSelectedEvent) {
    this.setState({
      mode: 'logs',
    });
  }
}

export class LogExplorationScene extends SceneObjectBase {
  static Component = ({ model }: SceneComponentProps<LogExplorationScene>) => {
    const logExploration = sceneGraph.getAncestor(model, IndexScene);
    const { controls, topScene, patterns } = logExploration.useState();
    const styles = useStyles2(getStyles);
    return (
      <div className={styles.container}>
        {controls && (
          <div className={styles.controlsContainer}>
            <div className={styles.filters}>
              {controls.map((control) =>
                control instanceof VariableValueSelectors ? (
                  <control.Component key={control.state.key} model={control} />
                ) : null
              )}
            </div>
            <div className={styles.controls}>
              <Badge text={'Preview'} color={'blue'} icon={'rocket'} />
              {controls.map((control) =>
                control instanceof VariableValueSelectors === false ? (
                  <control.Component key={control.state.key} model={control} />
                ) : null
              )}
            </div>
          </div>
        )}
        <PatternControls
          patterns={patterns}
          onRemove={(patterns: AppliedPattern[]) => logExploration.setState({ patterns })}
        />
        <div className={styles.body}>{topScene && <topScene.Component model={topScene} />}</div>
      </div>
    );
  };
}

function getTopScene(mode?: LogExplorationMode) {
  if (mode === 'logs') {
    return new ServiceScene({});
  }
  return new ServiceSelectionComponent({});
}

function getVariableSet(initialDS?: string, initialFilters?: AdHocVariableFilter[]) {
  const operators = ['=', '!='].map<SelectableValue<string>>((value) => ({
    label: value,
    value,
  }));

  const filterVariable = new AdHocFiltersVariable({
    name: VAR_FILTERS,
    datasource: explorationDS,
    layout: 'vertical',
    label: 'Service',
    filters: initialFilters ?? [],
    expressionBuilder: renderLogQLLabelFilters,
    hide: VariableHide.hideLabel,
    key: 'adhoc_service_filter',
  });

  filterVariable._getOperators = () => {
    return [
      {
        label: '=',
        value: '=',
      },
    ];
  };

  const fieldsVariable = new AdHocFiltersVariable({
    name: VAR_FIELDS,
    label: 'Filters',
    applyMode: 'manual',
    layout: 'vertical',
    getTagKeysProvider: () => Promise.resolve({ values: [] }),
    getTagValuesProvider: () => Promise.resolve({ values: [] }),
    expressionBuilder: renderLogQLFieldFilters,
    hide: VariableHide.hideLabel,
  });

  fieldsVariable._getOperators = () => {
    return operators;
  };

  const dsVariable = new DataSourceVariable({
    name: VAR_DATASOURCE,
    label: 'Data source',
    value: initialDS,
    pluginId: 'loki',
  });
  dsVariable.subscribeToState((newState) => {
    const dsValue = `${newState.value}`;
    newState.value && addLastUsedDataSourceToStorage(dsValue);
  });
  return new SceneVariableSet({
    variables: [
      dsVariable,
      filterVariable,
      fieldsVariable,
      new CustomVariable({
        name: VAR_PATTERNS,
        value: '',
        hide: VariableHide.hideVariable,
      }),
      new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable }),
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
      maxWidth: '100vw',
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    controlsContainer: css({
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }),
    filters: css({
      display: 'flex',
      gap: theme.spacing(2),
      width: 'calc(100% - 450)',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      '& + div[data-testid="data-testid Dashboard template variables submenu Label Filters"]:empty': {
        visibility: 'hidden',
      },

      //@todo not like this
      // The filter variables container: i.e. services, filters
      '&:first-child': {
        // The wrapper of each filter
        '& > div': {
          // the 'service_name' filter wrapper
          '&:nth-child(2) > div': {
            gap: 0,
          },
          // The actual inputs container
          '& > div': {
            flexWrap: 'wrap',
            // wrapper around all inputs
            '& > div': {
              maxWidth: '380px',

              // Wrapper around each input: i.e. label name, binary operator, value
              '& > div': {
                // These inputs need to flex, otherwise the value takes all of available space and they look broken
                flex: '1 0 auto',

                // The value input needs to shrink when the parent component is at max width
                '&:nth-child(3)': {
                  flex: '0 1 auto',
                },
              },
            },
          },
        },
      },

      ['div >[title="Add filter"]']: {
        border: 0,
        visibility: 'hidden',
        width: 0,
        padding: 0,
        margin: 0,
      },
    }),
    controls: css({
      display: 'flex',
      paddingTop: theme.spacing(3),
      gap: theme.spacing(1),
    }),
    rotateIcon: css({
      svg: { transform: 'rotate(180deg)' },
    }),
  };
}
