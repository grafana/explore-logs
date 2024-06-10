import React from 'react';

import { AdHocVariableFilter, SelectableValue, VariableHide } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  getUrlSyncManager,
  SceneComponentProps,
  SceneControlsSpacer,
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
  VariableValueSelectors,
} from '@grafana/scenes';
import {
  explorationDS,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FILTERS,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from 'services/variables';

import { addLastUsedDataSourceToStorage, getLastUsedDataSourceFromStorage } from 'services/store';
import { ServiceScene } from '../ServiceScene/ServiceScene';
import { ServiceSelectionComponent, StartingPointSelectedEvent } from '../ServiceSelectionScene/ServiceSelectionScene';
import { LayoutScene } from './LayoutScene';

type LogExplorationMode = 'service_selection' | 'service_details';

export interface AppliedPattern {
  pattern: string;
  type: 'include' | 'exclude';
}

export interface IndexSceneState extends SceneObjectState {
  // contentScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  contentScene?: SceneObject;
  controls: SceneObject[];
  body: LayoutScene;
  // mode is the current mode of the index scene - it can be either 'service_selection' or 'service_details'
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
      body: new LayoutScene({}),
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<IndexScene>) => {
    const { body } = model.useState();

    return <body.Component model={body} />;
  };

  public onActivate() {
    if (!this.state.contentScene) {
      this.setState({ contentScene: getContentScene(this.state.mode) });
    }

    // Some scene elements publish this
    this.subscribeToEvent(StartingPointSelectedEvent, this._handleStartingPointSelected.bind(this));

    this.subscribeToState((newState, oldState) => {
      if (newState.mode !== oldState.mode) {
        this.setState({ contentScene: getContentScene(newState.mode) });
      }

      const patternsVariable = sceneGraph.lookupVariable(VAR_PATTERNS, this);
      if (patternsVariable instanceof CustomVariable) {
        const patternsLine = renderPatternFilters(newState.patterns ?? []);
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
      patterns: this.state.mode === 'service_selection' ? '' : JSON.stringify(this.state.patterns),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<IndexSceneState> = {};
    if (values.mode !== this.state.mode) {
      const mode: LogExplorationMode = (values.mode as LogExplorationMode) ?? 'service_selection';
      stateUpdate.mode = mode;
      stateUpdate.contentScene = getContentScene(mode);
    }
    if (this.state.mode === 'service_selection') {
      // Clear patterns on start
      stateUpdate.patterns = undefined;
    } else if (values.patterns && typeof values.patterns === 'string') {
      stateUpdate.patterns = JSON.parse(values.patterns) as AppliedPattern[];
    }
    this.setState(stateUpdate);
  }

  private _handleStartingPointSelected(evt: StartingPointSelectedEvent) {
    this.setState({
      mode: 'service_details',
    });
  }
}

function getContentScene(mode?: LogExplorationMode) {
  if (mode === 'service_details') {
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
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
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
      new CustomVariable({ name: VAR_LOGS_FORMAT, value: '', hide: VariableHide.hideVariable }),
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

export function renderPatternFilters(patterns: AppliedPattern[]) {
  const excludePatterns = patterns.filter((pattern) => pattern.type === 'exclude');
  const excludePatternsLine = excludePatterns
    .map((p) => `!> \`${p.pattern}\``)
    .join(' ')
    .trim();

  const includePatterns = patterns.filter((pattern) => pattern.type === 'include');
  let includePatternsLine = '';
  if (includePatterns.length > 0) {
    if (includePatterns.length === 1) {
      includePatternsLine = `|> \`${includePatterns[0].pattern}\``;
    } else {
      includePatternsLine = `|>  ${includePatterns.map((p) => `\`${p.pattern}\``).join(' or ')}`;
    }
  }
  return `${excludePatternsLine} ${includePatternsLine}`.trim();
}
