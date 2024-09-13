import React from 'react';

import { AdHocVariableFilter, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
  getUrlSyncManager,
  SceneComponentProps,
  SceneControlsSpacer,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneRouteMatch,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
} from '@grafana/scenes';
import {
  EXPLORATION_DS,
  MIXED_FORMAT_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_PATTERNS,
} from 'services/variables';

import { addLastUsedDataSourceToStorage, getLastUsedDataSourceFromStorage } from 'services/store';
import { ServiceScene } from '../ServiceScene/ServiceScene';
import { LayoutScene } from './LayoutScene';
import { FilterOp } from 'services/filters';
import { getDrilldownSlug, PageSlugs } from '../../services/routing';
import { ServiceSelectionScene } from '../ServiceSelectionScene/ServiceSelectionScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import {
  renderLogQLFieldFilters,
  renderLogQLLabelFilters,
  renderLogQLMetadataFilters,
  renderPatternFilters,
} from 'services/query';
import { VariableHide } from '@grafana/schema';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import {
  getFieldsVariable,
  getLevelsVariable,
  getPatternsVariable,
  getUrlParamNameForVariable,
} from '../../services/variableGetters';

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
  patterns?: AppliedPattern[];
  routeMatch?: SceneRouteMatch<{ service?: string; label?: string }>;
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['patterns'] });

  public constructor(state: Partial<IndexSceneState>) {
    const { variablesScene, unsub } = getVariableSet(
      getLastUsedDataSourceFromStorage() ?? 'grafanacloud-logs',
      state.initialFilters
    );
    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? variablesScene,
      controls: state.controls ?? [
        new VariableValueSelectors({ layout: 'vertical' }),
        new SceneControlsSpacer(),
        new SceneTimePicker({}),
        new SceneRefreshPicker({}),
      ],
      // Need to clear patterns state when the class in constructed
      patterns: [],
      ...state,
      body: new LayoutScene({}),
    });

    this._subs.add(unsub);
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

    if (!this.state.contentScene) {
      stateUpdate.contentScene = getContentScene(this.state.routeMatch?.params.label);
    }

    this.setState(stateUpdate);

    this.updatePatterns(this.state, getPatternsVariable(this));
    this.resetVariablesIfNotInUrl(getFieldsVariable(this), getUrlParamNameForVariable(VAR_FIELDS));
    this.resetVariablesIfNotInUrl(getLevelsVariable(this), getUrlParamNameForVariable(VAR_LEVELS));

    this._subs.add(
      this.subscribeToState((newState) => {
        this.updatePatterns(newState, getPatternsVariable(this));
      })
    );

    return () => {
      getUrlSyncManager().cleanUp(this);
    };
  }

  /**
   * @todo why do we need to manually sync fields and levels, but not other ad hoc variables?
   * @param variable
   * @param urlParamName
   * @private
   */
  private resetVariablesIfNotInUrl(variable: AdHocFiltersVariable, urlParamName: string) {
    const location = locationService.getLocation();
    const search = new URLSearchParams(location.search);
    const filtersFromUrl = search.get(urlParamName);

    // If the filters aren't in the URL, then they're coming from the cache, set the state to sync with url
    if (filtersFromUrl === null) {
      variable.setState({ filters: [] });
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

function getContentScene(drillDownLabel?: string) {
  const slug = getDrilldownSlug();
  if (slug === PageSlugs.explore) {
    return new ServiceSelectionScene({});
  }

  return new ServiceScene({
    drillDownLabel,
  });
}

function getVariableSet(initialDatasourceUid: string, initialFilters?: AdHocVariableFilter[]) {
  const operators = [FilterOp.Equal, FilterOp.NotEqual].map<SelectableValue<string>>((value) => ({
    label: value,
    value,
  }));

  const labelVariable = new AdHocFiltersVariable({
    name: VAR_LABELS,
    datasource: EXPLORATION_DS,
    layout: 'vertical',
    label: 'Service',
    filters: initialFilters ?? [],
    expressionBuilder: renderLogQLLabelFilters,
    hide: VariableHide.hideLabel,
    key: 'adhoc_service_filter',
  });

  labelVariable._getOperators = function () {
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

  const levelsVariable = new AdHocFiltersVariable({
    name: VAR_LEVELS,
    label: 'Filters',
    applyMode: 'manual',
    layout: 'vertical',
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
    expressionBuilder: renderLogQLMetadataFilters,
    hide: VariableHide.hideLabel,
  });

  levelsVariable._getOperators = () => {
    return operators;
  };

  const dsVariable = new DataSourceVariable({
    name: VAR_DATASOURCE,
    label: 'Data source',
    value: initialDatasourceUid,
    pluginId: 'loki',
  });

  const unsub = dsVariable.subscribeToState((newState) => {
    const dsValue = `${newState.value}`;
    newState.value && addLastUsedDataSourceToStorage(dsValue);
  });

  return {
    variablesScene: new SceneVariableSet({
      variables: [
        dsVariable,
        labelVariable,
        fieldsVariable,
        levelsVariable,
        // @todo where is patterns being added to the url? Why do we have var-patterns and patterns?
        new CustomVariable({
          name: VAR_PATTERNS,
          value: '',
          hide: VariableHide.hideVariable,
        }),
        new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable }),

        // This variable is a hack to get logs context working, this variable should never be used or updated
        new CustomConstantVariable({
          name: VAR_LOGS_FORMAT,
          value: MIXED_FORMAT_EXPR,
          skipUrlSync: true,
          hide: VariableHide.hideVariable,
          options: [{ value: MIXED_FORMAT_EXPR, label: MIXED_FORMAT_EXPR }],
        }),
      ],
    }),
    unsub,
  };
}
