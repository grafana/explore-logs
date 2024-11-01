import React from 'react';

import {
  AdHocVariableFilter,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  GetTagResponse,
  MetricFindValue,
  SelectableValue,
} from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  DataSourceVariable,
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
  DETECTED_FIELD_VALUES_EXPR,
  DETECTED_LEVELS_VALUES_EXPR,
  DETECTED_METADATA_VALUES_EXPR,
  EXPLORATION_DS,
  MIXED_FORMAT_EXPR,
  PENDING_FIELDS_EXPR,
  SERVICE_NAME,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LOGS_FORMAT,
  VAR_METADATA,
  VAR_PATTERNS,
  VAR_SERVICE_SELECTION_TAB,
} from 'services/variables';

import { addLastUsedDataSourceToStorage, getLastUsedDataSourceFromStorage } from 'services/store';
import { ServiceScene } from '../ServiceScene/ServiceScene';
import { LayoutScene } from './LayoutScene';
import { FilterOp } from 'services/filters';
import { getDrilldownSlug, PageSlugs } from '../../services/routing';
import { ServiceSelectionScene } from '../ServiceSelectionScene/ServiceSelectionScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { config, DataSourceWithBackend, getDataSourceSrv, locationService } from '@grafana/runtime';
import {
  getLogQLLabelGroups,
  renderLogQLFieldFilters,
  renderLogQLLabelFilters,
  renderLogQLMetadataFilters,
  renderPatternFilters,
} from 'services/query';
import { VariableHide } from '@grafana/schema';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getMetadataVariable,
  getPatternsVariable,
  getUrlParamNameForVariable,
  getValueFromFieldsFilter,
} from '../../services/variableGetters';
import { ToolbarScene } from './ToolbarScene';
import { OptionalRouteMatch } from '../Pages';
import { AdHocFilterWithLabels, getDetectedFieldValuesTagValuesProvider } from '../../services/TagValuesProvider';
import { lokiRegularEscape } from '../../services/fields';
import { logger } from '../../services/logger';
import { getDataSource } from '../../services/scenes';
import { LokiQuery } from '../../services/lokiQuery';
import { isArray } from 'lodash';

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
  routeMatch?: OptionalRouteMatch;
}

function joinTagFilters(variable: AdHocFiltersVariable) {
  const { positiveGroups, negative } = getLogQLLabelGroups(variable.state.filters);

  const filters: AdHocFilterWithLabels[] = [];
  for (const key in positiveGroups) {
    const values = positiveGroups[key].map((filter) => filter.value);
    if (values.length === 1) {
      filters.push({
        key,
        value: positiveGroups[key][0].value,
        operator: '=',
      });
    } else {
      filters.push({
        key,
        value: values.join('|'),
        operator: '=~',
      });
    }
  }

  negative.forEach((filter) => {
    filters.push(filter);
  });
  return filters;
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['patterns'] });

  public constructor(state: Partial<IndexSceneState>) {
    const { variablesScene, unsub } = getVariableSet(
      getLastUsedDataSourceFromStorage() ?? 'grafanacloud-logs',
      state.initialFilters
    );

    const controls: SceneObject[] = [
      new VariableValueSelectors({ layout: 'vertical' }),
      new SceneControlsSpacer(),
      new SceneTimePicker({}),
      new SceneRefreshPicker({}),
    ];

    if (getDrilldownSlug() === 'explore' && config.featureToggles.exploreLogsAggregatedMetrics) {
      controls.push(
        new ToolbarScene({
          isOpen: false,
        })
      );
    }

    super({
      $timeRange: state.$timeRange ?? new SceneTimeRange({}),
      $variables: state.$variables ?? variablesScene,
      controls: state.controls ?? controls,
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

  private getTagKeysProvider = async (
    variable: AdHocFiltersVariable
  ): Promise<{
    replace?: boolean;
    values: GetTagResponse | MetricFindValue[];
  }> => {
    const datasource_ = await getDataSourceSrv().get(getDataSource(this));
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagKeysProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as DataSourceWithBackend<LokiQuery>;

    if (datasource && datasource.getTagKeys) {
      const filters = joinTagFilters(variable);

      const options: DataSourceGetTagKeysOptions<LokiQuery> = {
        filters,
      };

      const result = await datasource.getTagKeys(options);
      return { replace: true, values: result };
    } else {
      logger.error(new Error('getTagKeysProvider: missing or invalid datasource!'));
      return { replace: true, values: [] };
    }
  };

  private getTagValuesProvider = async (
    variable: AdHocFiltersVariable,
    filter: AdHocFilterWithLabels
  ): Promise<{
    replace?: boolean;
    values: GetTagResponse | MetricFindValue[];
  }> => {
    const datasource_ = await getDataSourceSrv().get(getDataSource(this));
    if (!(datasource_ instanceof DataSourceWithBackend)) {
      logger.error(new Error('getTagValuesProvider: Invalid datasource!'));
      throw new Error('Invalid datasource!');
    }
    const datasource = datasource_ as DataSourceWithBackend<LokiQuery>;

    if (datasource && datasource.getTagValues) {
      // Filter out other values for this key so users can include other values for this label
      const filters = joinTagFilters(variable).filter((f) => !(filter.operator === '=' && f.key === filter.key));

      const options: DataSourceGetTagValuesOptions<LokiQuery> = {
        key: filter.key,
        filters,
      };
      let results = await datasource.getTagValues(options);

      if (isArray(results)) {
        results = results.filter((result) => {
          // Filter out values that we already have added as filters
          return !variable.state.filters
            .filter((f) => f.key === filter.key)
            .some((f) => {
              // If true, the results should be filtered out
              return f.operator === '=' && f.value === result.text;
            });
        });
      }

      return { replace: true, values: results };
    } else {
      logger.error(new Error('getTagValuesProvider: missing or invalid datasource!'));
      return { replace: true, values: [] };
    }
  };

  public onActivate() {
    const stateUpdate: Partial<IndexSceneState> = {};
    this.setVariableTagValuesProviders();

    if (!this.state.contentScene) {
      stateUpdate.contentScene = getContentScene(this.state.routeMatch?.params.breakdownLabel);
    }

    const labelsVar = getLabelsVariable(this);
    labelsVar.setState({
      getTagKeysProvider: this.getTagKeysProvider,
      getTagValuesProvider: this.getTagValuesProvider,
    });

    this.setState(stateUpdate);

    this.updatePatterns(this.state, getPatternsVariable(this));
    this.resetVariablesIfNotInUrl(getFieldsVariable(this), getUrlParamNameForVariable(VAR_FIELDS));
    this.resetVariablesIfNotInUrl(getLevelsVariable(this), getUrlParamNameForVariable(VAR_LEVELS));

    this._subs.add(
      this.subscribeToState((newState) => {
        this.updatePatterns(newState, getPatternsVariable(this));
      })
    );
  }

  private setVariableTagValuesProviders() {
    const fieldsVariable = getFieldsVariable(this);
    const levelsVariable = getLevelsVariable(this);
    const metadataVariable = getMetadataVariable(this);

    fieldsVariable.setState({
      getTagValuesProvider: this.getFieldsTagValuesProvider(VAR_FIELDS),
    });

    levelsVariable.setState({
      getTagValuesProvider: this.getFieldsTagValuesProvider(VAR_LEVELS),
    });

    metadataVariable.setState({
      getTagValuesProvider: this.getFieldsTagValuesProvider(VAR_METADATA),
    });
  }

  private getFieldsTagValuesProvider(variableType: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS) {
    return (variable: AdHocFiltersVariable, filter: AdHocFilterWithLabels) => {
      const filters = variable.state.filters.filter((f) => f.key !== filter.key);
      const values = filters.map((f) => {
        const parsed = variableType === VAR_FIELDS ? getValueFromFieldsFilter(f, variableType) : { value: f.value };
        return `${f.key}${f.operator}\`${lokiRegularEscape(parsed.value)}\``;
      });
      const otherFiltersString = values.length ? '| ' + values.join(' |') : '';
      const uninterpolatedExpression = this.getFieldsTagValuesExpression(variableType);
      const expr = uninterpolatedExpression.replace(PENDING_FIELDS_EXPR, otherFiltersString);
      const interpolated = sceneGraph.interpolate(this, expr);
      return getDetectedFieldValuesTagValuesProvider(
        filter,
        interpolated,
        this,
        sceneGraph.getTimeRange(this).state.value,
        variableType
      );
    };
  }

  private getFieldsTagValuesExpression(variableType: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS) {
    switch (variableType) {
      case VAR_FIELDS:
        return DETECTED_FIELD_VALUES_EXPR;
      case VAR_METADATA:
        return DETECTED_METADATA_VALUES_EXPR;
      case VAR_LEVELS:
        return DETECTED_LEVELS_VALUES_EXPR;
      default:
        const error = new Error(`Unknown variable type: ${variableType}`);
        logger.error(error, {
          variableType,
        });
        throw error;
    }
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

export const variableOperators = [FilterOp.Equal, FilterOp.NotEqual].map<SelectableValue<string>>((value) => ({
  label: value,
  value,
}));

function getVariableSet(initialDatasourceUid: string, initialFilters?: AdHocVariableFilter[]) {
  const labelVariable = new AdHocFiltersVariable({
    name: VAR_LABELS,
    datasource: EXPLORATION_DS,
    layout: 'combobox',
    label: 'Service',
    filters: initialFilters ?? [],
    expressionBuilder: renderLogQLLabelFilters,
    hide: VariableHide.hideLabel,
    key: 'adhoc_service_filter',
    supportsMultiValueOperators: true,
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
  });

  labelVariable._getOperators = function () {
    return variableOperators;
  };

  const fieldsVariable = new AdHocFiltersVariable({
    name: VAR_FIELDS,
    label: 'Filters',
    applyMode: 'manual',
    layout: 'vertical',
    expressionBuilder: renderLogQLFieldFilters,
    hide: VariableHide.hideLabel,
  });

  fieldsVariable._getOperators = () => {
    return variableOperators;
  };

  const metadataVariable = new AdHocFiltersVariable({
    name: VAR_METADATA,
    label: 'Metadata',
    applyMode: 'manual',
    layout: 'vertical',
    expressionBuilder: renderLogQLMetadataFilters,
    hide: VariableHide.hideLabel,
  });

  metadataVariable._getOperators = () => {
    return variableOperators;
  };

  const levelsVariable = new AdHocFiltersVariable({
    name: VAR_LEVELS,
    label: 'Filters',
    applyMode: 'manual',
    layout: 'vertical',
    expressionBuilder: renderLogQLMetadataFilters,
    hide: VariableHide.hideLabel,
    supportsMultiValueOperators: true,
  });

  levelsVariable._getOperators = () => {
    return variableOperators;
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

  // The active tab expression, hidden variable
  const primaryLabel = new AdHocFiltersVariable({
    name: VAR_SERVICE_SELECTION_TAB,
    hide: VariableHide.hideVariable,
    expressionBuilder: (filters) => {
      return renderPrimaryLabelFilters(filters);
    },
    filters: [
      {
        key: getSelectedTabFromUrl().key ?? SERVICE_NAME,
        value: '.+',
        operator: '=~',
      },
    ],
  });

  return {
    variablesScene: new SceneVariableSet({
      variables: [
        primaryLabel,
        dsVariable,
        labelVariable,
        fieldsVariable,
        levelsVariable,
        metadataVariable,
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

function renderPrimaryLabelFilters(filters: AdHocVariableFilter[]): string {
  if (filters.length) {
    const filter = filters[0];
    return `${filter.key}${filter.operator}\`${filter.value}\``;
  }

  return '';
}

export function getSelectedTabFromUrl() {
  const location = locationService.getLocation();
  const search = new URLSearchParams(location.search);
  const primaryLabelRaw = search.get(primaryLabelUrlKey);
  const primaryLabelSplit = primaryLabelRaw?.split('|');
  const key = primaryLabelSplit?.[0];
  return { key, search, location };
}

export const primaryLabelUrlKey = 'var-service_selection_tab';
