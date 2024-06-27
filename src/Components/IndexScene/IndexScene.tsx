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
import { LayoutScene } from './LayoutScene';
import { FilterOp } from 'services/filters';
import { SLUGS } from '../../services/routing';
import { getSlug } from '../Pages';
import { ServiceSelectionScene } from '../ServiceSelectionScene/ServiceSelectionScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { locationService } from '@grafana/runtime';

export interface AppliedPattern {
  pattern: string;
  type: 'include' | 'exclude';
}

export interface IndexSceneState extends SceneObjectState {
  // contentScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  contentScene?: SceneObject;
  controls: SceneObject[];
  body?: LayoutScene;
  initialFilters?: AdHocVariableFilter[];
  initialDS?: string;
  patterns?: AppliedPattern[];
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['patterns'] });

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
      // Need to clear patterns state when the class in constructed
      patterns: [],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<IndexScene>) => {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };

  public onActivate() {
    const stateUpdate: Partial<IndexSceneState> = {};
    stateUpdate.body = new LayoutScene({});

    if (!this.state.contentScene) {
      stateUpdate.contentScene = getContentScene();
    }

    this.setState(stateUpdate);
    const patternsVariable = sceneGraph.lookupVariable(VAR_PATTERNS, this);
    if (patternsVariable instanceof CustomVariable) {
      this.updatePatterns(this.state, patternsVariable);
    }

    const fieldsVariable = sceneGraph.lookupVariable(VAR_FIELDS, this);
    if (fieldsVariable instanceof AdHocFiltersVariable) {
      this.syncFieldsWithUrl(fieldsVariable);
    }

    this._subs.add(
      this.subscribeToState((newState) => {
        const patternsVariable = sceneGraph.lookupVariable(VAR_PATTERNS, this);
        if (patternsVariable instanceof CustomVariable) {
          this.updatePatterns(newState, patternsVariable);
        }
      })
    );

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  /**
   * @todo why do we need to manually sync fields, but nothing else?
   * @param fieldsVariable
   * @private
   */
  private syncFieldsWithUrl(fieldsVariable: AdHocFiltersVariable) {
    const location = locationService.getLocation();
    const search = new URLSearchParams(location.search);
    const filtersFromUrl = search.get('var-fields');

    // If the filters aren't in the URL, then they're coming from the cache, set the state to sync with url
    if (filtersFromUrl === null) {
      fieldsVariable.setState({ filters: [] });
    }
  }

  private updatePatterns(newState: IndexSceneState, patternsVariable: CustomVariable) {
    const patternsLine = renderPatternFilters(newState.patterns ?? []);
    patternsVariable.changeValueTo(patternsLine);
  }

  getUrlState() {
    return {
      patterns: JSON.stringify(this.state.patterns),
    };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<IndexSceneState> = {};

    if (values.patterns && typeof values.patterns === 'string') {
      stateUpdate.patterns = JSON.parse(values.patterns) as AppliedPattern[];
    }

    this.setState(stateUpdate);
  }
}

function getContentScene() {
  const slug = getSlug();
  if (slug === SLUGS.explore) {
    return new ServiceSelectionScene({});
  }

  return new ServiceScene({});
}

function getVariableSet(initialDS?: string, initialFilters?: AdHocVariableFilter[]) {
  const operators = [FilterOp.Equal, FilterOp.NotEqual].map<SelectableValue<string>>((value) => ({
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

  filterVariable._getOperators = function () {
    return operators;
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
      // @todo where is patterns being added to the url? Why do we have var-patterns and patterns?
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
