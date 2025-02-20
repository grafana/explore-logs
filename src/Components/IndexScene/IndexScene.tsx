import React from 'react';

import { AdHocVariableFilter, AppEvents, AppPluginMeta, rangeUtil } from '@grafana/data';
import {
  AdHocFiltersVariable,
  AdHocFilterWithLabels,
  CustomVariable,
  DataSourceVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneTimeRangeLike,
  SceneTimeRangeState,
  SceneVariableSet,
} from '@grafana/scenes';
import {
  AppliedPattern,
  AdHocFiltersWithLabelsAndMeta,
  EXPLORATION_DS,
  MIXED_FORMAT_EXPR,
  PENDING_FIELDS_EXPR,
  PENDING_METADATA_EXPR,
  VAR_DATASOURCE,
  VAR_FIELDS,
  VAR_FIELDS_AND_METADATA,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_LINE_FILTER,
  VAR_LINE_FILTERS,
  VAR_LOGS_FORMAT,
  VAR_METADATA,
  VAR_PATTERNS,
} from 'services/variables';

import { addLastUsedDataSourceToStorage, getLastUsedDataSourceFromStorage } from 'services/store';
import { ServiceScene } from '../ServiceScene/ServiceScene';
import {
  CONTROLS_VARS_DATASOURCE,
  CONTROLS_VARS_FIELDS,
  CONTROLS_VARS_FIELDS_COMBINED,
  CONTROLS_VARS_FIRST_ROW_KEY,
  CONTROLS_VARS_LABELS,
  CONTROLS_VARS_METADATA_ROW_KEY,
  CONTROLS_VARS_REFRESH,
  CONTROLS_VARS_TIMEPICKER,
  CONTROLS_VARS_TOOLBAR,
  LayoutScene,
} from './LayoutScene';
import { getDrilldownSlug, PageSlugs } from '../../services/routing';
import { ServiceSelectionScene } from '../ServiceSelectionScene/ServiceSelectionScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { config, getAppEvents, locationService } from '@grafana/runtime';
import {
  onAddCustomAdHocValue,
  onAddCustomFieldValue,
  renderLevelsFilter,
  renderLogQLFieldFilters,
  renderLogQLLabelFilters,
  renderLogQLLineFilter,
  renderLogQLMetadataFilters,
} from 'services/query';
import { VariableHide } from '@grafana/schema';
import { CustomConstantVariable } from '../../services/CustomConstantVariable';
import {
  getDataSourceVariable,
  getFieldsAndMetadataVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getMetadataVariable,
  getPatternsVariable,
  getUrlParamNameForVariable,
} from '../../services/variableGetters';
import { ToolbarScene } from './ToolbarScene';
import { DEFAULT_TIME_RANGE, OptionalRouteMatch } from '../Pages';
import { plugin } from '../../module';
import { JsonData } from '../AppConfig/AppConfig';
import { reportAppInteraction } from '../../services/analytics';
import { getDetectedFieldValuesTagValuesProvider, getLabelsTagValuesProvider } from '../../services/TagValuesProviders';
import { logger } from '../../services/logger';
import { getFieldsKeysProvider, getLabelsTagKeysProvider } from '../../services/TagKeysProviders';
import { getLokiDatasource } from '../../services/scenes';
import { ShowLogsButtonScene } from './ShowLogsButtonScene';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import { getCopiedTimeRange, PasteTimeEvent, setupKeyboardShortcuts } from '../../services/keyboardShortcuts';
import { LokiDatasource } from '../../services/lokiQuery';
import { lineFilterOperators, operators } from '../../services/operators';
import { operatorFunction } from '../../services/variableHelpers';
import { FilterOp } from '../../services/filterTypes';
import { areArraysEqual } from '../../services/comparison';
import { isFilterMetadata } from '../../services/filters';
import { getFieldsTagValuesExpression } from '../../services/expressions';
import { isOperatorInclusive } from '../../services/operatorHelpers';
import { renderPatternFilters } from '../../services/renderPatternFilters';
import { NoLokiSplash } from '../NoLokiSplash';

export const showLogsButtonSceneKey = 'showLogsButtonScene';

export interface IndexSceneState extends SceneObjectState {
  // contentScene is the scene that is displayed in the main body of the index scene - it can be either the service selection or service scene
  contentScene?: SceneObject;
  controls: SceneObject[];
  body?: LayoutScene;
  initialFilters?: AdHocVariableFilter[];
  patterns?: AppliedPattern[];
  routeMatch?: OptionalRouteMatch;
  ds?: LokiDatasource;
}

export class IndexScene extends SceneObjectBase<IndexSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['patterns'] });

  public constructor(state: Partial<IndexSceneState>) {
    const { variablesScene, unsub } = getVariableSet(
      getLastUsedDataSourceFromStorage() ?? 'grafanacloud-logs',
      state.initialFilters
    );

    const controls: SceneObject[] = [
      new SceneFlexLayout({
        key: CONTROLS_VARS_FIRST_ROW_KEY,
        direction: 'row',
        children: [
          new SceneFlexItem({
            body: new CustomVariableValueSelectors({
              key: CONTROLS_VARS_LABELS,
              layout: 'vertical',
              include: [VAR_LABELS],
            }),
          }),
          new ShowLogsButtonScene({
            key: showLogsButtonSceneKey,
            disabled: true,
          }),
        ],
      }),
      new CustomVariableValueSelectors({
        key: CONTROLS_VARS_METADATA_ROW_KEY,
        layout: 'vertical',
        include: [VAR_METADATA],
      }),
      new CustomVariableValueSelectors({
        key: CONTROLS_VARS_FIELDS,
        layout: 'vertical',
        include: [VAR_FIELDS],
      }),
      new CustomVariableValueSelectors({
        key: CONTROLS_VARS_DATASOURCE,
        layout: 'horizontal',
        include: [VAR_DATASOURCE],
      }),
      new CustomVariableValueSelectors({
        key: CONTROLS_VARS_FIELDS_COMBINED,
        layout: 'vertical',
        include: [VAR_FIELDS_AND_METADATA],
      }),
      new SceneTimePicker({ key: CONTROLS_VARS_TIMEPICKER }),
      new SceneRefreshPicker({ key: CONTROLS_VARS_REFRESH }),
    ];

    if (getDrilldownSlug() === 'explore' && config.featureToggles.exploreLogsAggregatedMetrics) {
      controls.push(
        new ToolbarScene({
          key: CONTROLS_VARS_TOOLBAR,
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

    getLokiDatasource(this).then((ds) => {
      this.setState({ ds });
    });
  }

  static Component = ({ model }: SceneComponentProps<IndexScene>) => {
    const { body } = model.useState();

    const dsVar = getDataSourceVariable(model);
    if (!dsVar.state.options.length) {
      return <NoLokiSplash />;
    }

    if (body) {
      return <body.Component model={body} />;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };

  public onActivate() {
    const stateUpdate: Partial<IndexSceneState> = {};
    this.setVariableProviders();

    // Show "show logs" button
    const showLogsButton = sceneGraph.findByKeyAndType(this, showLogsButtonSceneKey, ShowLogsButtonScene);
    showLogsButton.setState({ hidden: false });

    if (!this.state.contentScene) {
      stateUpdate.contentScene = getContentScene(this.state.routeMatch?.params.breakdownLabel);
    }
    this.setTagProviders();
    this.setState(stateUpdate);

    this.updatePatterns(this.state, getPatternsVariable(this));
    this.resetVariablesIfNotInUrl(getFieldsVariable(this), getUrlParamNameForVariable(VAR_FIELDS));
    this.resetVariablesIfNotInUrl(getLevelsVariable(this), getUrlParamNameForVariable(VAR_LEVELS));

    this._subs.add(
      this.subscribeToState((newState) => {
        this.updatePatterns(newState, getPatternsVariable(this));
      })
    );

    const timeRange = sceneGraph.getTimeRange(this);

    this._subs.add(timeRange.subscribeToState(this.limitMaxInterval(timeRange)));
    this._subs.add(this.subscribeToEvent(PasteTimeEvent, this.subscribeToPasteTimeEvent));

    const fieldFilters = getFieldsVariable(this).state.filters;
    const metadataFilters = getMetadataVariable(this).state.filters;

    const fieldsAndMetadataVariable = getFieldsAndMetadataVariable(this);

    // Sync fields in query variables to support existing urls
    fieldsAndMetadataVariable.updateFilters([...metadataFilters, ...fieldFilters]);

    // Update the fields/metadata filters when the combined variable is changed in the variable UI.
    this._subs.add(fieldsAndMetadataVariable.subscribeToState(this.subscribeToCombinedFieldsVariable));

    const clearKeyBindings = setupKeyboardShortcuts(this);

    return () => {
      clearKeyBindings();
    };
  }

  private subscribeToCombinedFieldsVariable = (
    newState: AdHocFiltersVariable['state'],
    prevState?: AdHocFiltersVariable['state']
  ) => {
    if (!areArraysEqual(newState.filters, prevState?.filters)) {
      const metadataFilters = newState.filters.filter((f: AdHocFiltersWithLabelsAndMeta) => isFilterMetadata(f));
      const fieldFilters = newState.filters.filter((f: AdHocFiltersWithLabelsAndMeta) => !isFilterMetadata(f));

      getFieldsVariable(this).updateFilters(fieldFilters);
      getMetadataVariable(this).updateFilters(metadataFilters);
    }
  };

  private setTagProviders() {
    this.setLabelsProviders();
  }

  private setLabelsProviders() {
    const labelsVar = getLabelsVariable(this);

    labelsVar._getOperators = () => operatorFunction(labelsVar);

    labelsVar.setState({
      getTagKeysProvider: getLabelsTagKeysProvider,
      getTagValuesProvider: getLabelsTagValuesProvider,
    });
  }

  private subscribeToPasteTimeEvent = async () => {
    const copiedRange = await getCopiedTimeRange();

    if (copiedRange.isError) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this);
    const to = typeof copiedRange.range.to === 'string' ? copiedRange.range.to : undefined;
    const from = typeof copiedRange.range.from === 'string' ? copiedRange.range.from : undefined;
    const newRange = rangeUtil.convertRawToRange(copiedRange.range);

    if (timeRange && newRange) {
      timeRange.setState({
        value: newRange,
        to,
        from,
      });
    } else {
      logger.error(new Error('Invalid time range from clipboard'), {
        msg: 'Invalid time range from clipboard',
        sceneTimeRange: typeof timeRange,
        to: to ?? '',
        from: from ?? '',
      });
    }
  };

  /**
   * If user selects a time range longer then the max configured interval, show toast and set the previous time range.
   * @param timeRange
   * @private
   */
  private limitMaxInterval(timeRange: SceneTimeRangeLike) {
    return (newState: SceneTimeRangeState, prevState: SceneTimeRangeState) => {
      const { jsonData } = plugin.meta as AppPluginMeta<JsonData>;
      if (jsonData?.interval) {
        try {
          const maxInterval = rangeUtil.intervalToSeconds(jsonData?.interval ?? '');
          if (!maxInterval) {
            return;
          }
          const timeRangeInterval = newState.value.to.diff(newState.value.from, 'seconds');
          if (timeRangeInterval > maxInterval) {
            const prevInterval = prevState.value.to.diff(prevState.value.from, 'seconds');
            if (timeRangeInterval <= prevInterval) {
              timeRange.setState({
                value: prevState.value,
                from: prevState.from,
                to: prevState.to,
              });
            } else {
              const defaultRange = new SceneTimeRange(DEFAULT_TIME_RANGE);
              timeRange.setState({
                value: defaultRange.state.value,
                from: defaultRange.state.from,
                to: defaultRange.state.to,
              });
            }

            const appEvents = getAppEvents();
            appEvents.publish({
              type: AppEvents.alertWarning.name,
              payload: [`Time range interval exceeds maximum interval configured by the administrator.`],
            });

            reportAppInteraction('all', 'interval_too_long', {
              attempted_duration_seconds: timeRangeInterval,
              configured_max_interval: maxInterval,
            });
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
  }

  private setVariableProviders() {
    const levelsVariable = getLevelsVariable(this);
    const fieldsCombinedVariable = getFieldsAndMetadataVariable(this);

    fieldsCombinedVariable._getOperators = () => operatorFunction(fieldsCombinedVariable);

    levelsVariable.setState({
      getTagValuesProvider: this.getLevelsTagValuesProvider(),
      getTagKeysProvider: this.getLevelsTagKeysProvider(),
    });

    fieldsCombinedVariable.setState({
      getTagKeysProvider: this.getCombinedFieldsTagKeysProvider(),
      getTagValuesProvider: this.getCombinedFieldsTagValuesProvider(),
    });
  }

  /**
   * Get tag keys (label names) for the combined fields variable
   */
  private getCombinedFieldsTagKeysProvider() {
    return (variable: AdHocFiltersVariable, currentKey: string | null) => {
      // Current key seems to always be null, I think it's only supported for other variable types that allow editing the key without first removing the value/operator?
      const metadataVar = getMetadataVariable(this);
      const fieldVar = getFieldsVariable(this);

      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_FIELDS_AND_METADATA);

      const metadataFilters = metadataVar.state.filters.filter((f) => f.key !== currentKey);
      const fieldFilters = fieldVar.state.filters.filter((f) => f.key !== currentKey);
      const otherFiltersString = this.renderVariableFilters(VAR_FIELDS, fieldFilters);
      const otherMetadataString = this.renderVariableFilters(VAR_METADATA, metadataFilters);
      const expr = uninterpolatedExpression
        .replace(PENDING_FIELDS_EXPR, otherFiltersString)
        .replace(PENDING_METADATA_EXPR, otherMetadataString);
      const interpolated = sceneGraph.interpolate(this, expr);

      return getFieldsKeysProvider({
        expr: interpolated,
        sceneRef: this,
        timeRange: sceneGraph.getTimeRange(this).state.value,
        variableType: VAR_FIELDS_AND_METADATA,
      });
    };
  }

  /**
   * Get tag values (label values) for combined fields variable
   */
  private getCombinedFieldsTagValuesProvider() {
    return (variable: AdHocFiltersVariable, filter: AdHocFilterWithLabels) => {
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_FIELDS_AND_METADATA);
      const metadataVar = getMetadataVariable(this);
      const fieldVar = getFieldsVariable(this);

      const metadataFilters = metadataVar.state.filters.filter(
        (f) => f.key !== filter.key && isOperatorInclusive(f.operator)
      );
      const fieldFilters = fieldVar.state.filters.filter(
        (f) => f.key !== filter.key && isOperatorInclusive(f.operator)
      );

      const otherFiltersString = this.renderVariableFilters(VAR_FIELDS, fieldFilters);
      const otherMetadataString = this.renderVariableFilters(VAR_METADATA, metadataFilters);

      const expr = uninterpolatedExpression
        .replace(PENDING_FIELDS_EXPR, otherFiltersString)
        .replace(PENDING_METADATA_EXPR, otherMetadataString);
      const interpolated = sceneGraph.interpolate(this, expr);

      return getDetectedFieldValuesTagValuesProvider(
        filter,
        variable,
        interpolated,
        this,
        sceneGraph.getTimeRange(this).state.value,
        VAR_FIELDS_AND_METADATA
      );
    };
  }

  /**
   * Get tag keys (label names) for levels variable
   */
  private getLevelsTagKeysProvider() {
    return (variable: AdHocFiltersVariable, currentKey: string | null) => {
      // Current key seems to always be null, I think it's only supported for other variable types that allow editing the key without first removing the value/operator?
      const filters = variable.state.filters.filter((f) => f.key !== currentKey);
      const otherFiltersString = this.renderVariableFilters(VAR_LEVELS, filters);
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_LEVELS);
      const expr = uninterpolatedExpression.replace(PENDING_FIELDS_EXPR, otherFiltersString);
      const interpolated = sceneGraph.interpolate(this, expr);
      return getFieldsKeysProvider({
        expr: interpolated,
        sceneRef: this,
        timeRange: sceneGraph.getTimeRange(this).state.value,
        variableType: VAR_LEVELS,
      });
    };
  }

  /**
   * Get tag values (label values) for levels variable
   */
  private getLevelsTagValuesProvider() {
    return (variable: AdHocFiltersVariable, filter: AdHocFilterWithLabels) => {
      // Don't add equals operations to the query, the user might want to select more than one value
      const filters = variable.state.filters.filter((f) => f.key !== filter.key && f.operator === FilterOp.Equal);
      const otherFiltersString = this.renderVariableFilters(VAR_LEVELS, filters);
      const uninterpolatedExpression = getFieldsTagValuesExpression(VAR_LEVELS);
      const expr = uninterpolatedExpression.replace(PENDING_FIELDS_EXPR, otherFiltersString);
      const interpolated = sceneGraph.interpolate(this, expr);

      return getDetectedFieldValuesTagValuesProvider(
        filter,
        variable,
        interpolated,
        this,
        sceneGraph.getTimeRange(this).state.value,
        VAR_LEVELS
      );
    };
  }

  private renderVariableFilters(
    variableType: typeof VAR_FIELDS | typeof VAR_METADATA | typeof VAR_LEVELS,
    filters: AdHocFilterWithLabels[]
  ) {
    if (variableType === VAR_FIELDS) {
      return renderLogQLFieldFilters(filters);
    } else if (variableType === VAR_METADATA) {
      return renderLogQLMetadataFilters(filters);
    } else if (variableType === VAR_LEVELS) {
      return renderLogQLMetadataFilters(filters);
    } else {
      const error = new Error('getFieldsTagValuesProvider only supports fields, metadata, and levels');
      logger.error(error);
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

function getVariableSet(initialDatasourceUid: string, initialFilters?: AdHocVariableFilter[]) {
  const labelVariable = new AdHocFiltersVariable({
    name: VAR_LABELS,
    datasource: EXPLORATION_DS,
    layout: 'combobox',
    label: 'Labels',
    allowCustomValue: true,
    filters: initialFilters ?? [],
    expressionBuilder: renderLogQLLabelFilters,
    hide: VariableHide.dontHide,
    key: 'adhoc_service_filter',
    onAddCustomValue: onAddCustomAdHocValue,
  });

  labelVariable._getOperators = function () {
    return operators;
  };

  const fieldsVariable = new AdHocFiltersVariable({
    name: VAR_FIELDS,
    label: 'Detected fields',
    applyMode: 'manual',
    layout: 'combobox',
    expressionBuilder: renderLogQLFieldFilters,
    hide: VariableHide.hideVariable,
    allowCustomValue: true,
  });

  fieldsVariable._getOperators = () => {
    return operators;
  };

  const metadataVariable = new AdHocFiltersVariable({
    name: VAR_METADATA,
    label: 'Metadata',
    applyMode: 'manual',
    layout: 'combobox',
    expressionBuilder: (filters: AdHocFilterWithLabels[]) => renderLogQLMetadataFilters(filters),
    hide: VariableHide.hideVariable,
    allowCustomValue: true,
  });

  metadataVariable._getOperators = () => {
    return operators;
  };

  /**
   * Not used in interpolation, used as "proxy" variable that routes filters added in the variable UI
   * to the fields and metadata variables which are interpolated but not present in the UI.
   *
   * Not saved in the URL state, as on init we pull the values from the fields/metadata variables
   */
  const fieldsAndMetadataVariable = new AdHocFiltersVariable({
    name: VAR_FIELDS_AND_METADATA,
    label: 'Fields',
    applyMode: 'manual',
    layout: 'combobox',
    hide: VariableHide.hideVariable,
    allowCustomValue: true,
    onAddCustomValue: onAddCustomFieldValue,
    skipUrlSync: true,
  });

  const levelsVariable = new AdHocFiltersVariable({
    name: VAR_LEVELS,
    label: 'Error levels',
    applyMode: 'manual',
    layout: 'vertical',
    expressionBuilder: renderLevelsFilter,
    hide: VariableHide.hideVariable,
    supportsMultiValueOperators: true,
  });

  const lineFiltersVariable = new AdHocFiltersVariable({
    name: VAR_LINE_FILTERS,
    hide: VariableHide.hideVariable,
    getTagKeysProvider: () => Promise.resolve({ replace: true, values: [] }),
    getTagValuesProvider: () => Promise.resolve({ replace: true, values: [] }),
    expressionBuilder: renderLogQLLineFilter,
    layout: 'horizontal',
  });

  lineFiltersVariable._getOperators = () => {
    return lineFilterOperators;
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
        metadataVariable,
        fieldsAndMetadataVariable,
        new CustomVariable({
          name: VAR_PATTERNS,
          value: '',
          hide: VariableHide.hideVariable,
        }),
        new AdHocFiltersVariable({
          name: VAR_LINE_FILTER,
          hide: VariableHide.hideVariable,
          expressionBuilder: renderLogQLLineFilter,
        }),
        lineFiltersVariable,

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
