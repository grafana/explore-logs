import React from 'react';

import { AdHocVariableFilter, BusEventBase, DataFrame } from '@grafana/data';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import {
  LEVEL_VARIABLE_VALUE,
  VAR_FIELDS,
  VAR_FIELDS_AND_METADATA,
  VAR_LABELS,
  VAR_LABELS_REPLICA,
  VAR_LEVELS,
  VAR_METADATA,
} from 'services/variables';
import { FilterButton } from 'Components/FilterButton';
import { getDetectedLabelsFrame } from '../ServiceScene';
import { getParserForField } from '../../../services/fields';
import {
  getAdHocFiltersVariable,
  getFieldsAndMetadataVariable,
  getValueFromAdHocVariableFilter,
} from '../../../services/variableGetters';
import { FilterOp, NumericFilterOp } from '../../../services/filterTypes';

import { addToFavorites } from '../../../services/favorites';
import { areArraysEqual } from '../../../services/comparison';
import { logger } from '../../../services/logger';
import { isFilterMetadata } from '../../../services/filters';
import { addCurrentUrlToHistory } from '../../../services/navigate';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: InterpolatedFilterType;
  hideExclude?: boolean;
  isIncluded?: boolean;
  isExcluded?: boolean;
}

export class AddFilterEvent extends BusEventBase {
  constructor(
    public source: 'legend' | 'filterButton' | 'variable',
    public operator: FilterType | NumericFilterType,
    public key: string,
    public value?: string
  ) {
    super();
  }
  public static type = 'add-filter';
}

export class ClearFilterEvent extends BusEventBase {
  constructor(public key: string, public value?: string, public operator?: FilterType) {
    super();
  }
  public static type = 'add-filter';
}

export type NumericFilterType = NumericFilterOp.gt | NumericFilterOp.gte | NumericFilterOp.lt | NumericFilterOp.lte;

/**
 * Filter types:
 * - include/exclude: add a negative or positive filter
 * - clear: remove filter if exists
 * - toggle: if the filter does not exist, add as include; if exists, remove
 */
export type FilterType = 'include' | 'clear' | 'exclude' | 'toggle';

export function addAdHocFilter(filter: AdHocVariableFilter, scene: SceneObject, variableType: InterpolatedFilterType) {
  const type: FilterType = filter.operator === '=' ? 'include' : 'exclude';
  addToFilters(filter.key, filter.value, type, scene, variableType);
}

export type InterpolatedFilterType = typeof VAR_LABELS | typeof VAR_FIELDS | typeof VAR_LEVELS | typeof VAR_METADATA;
export type UIVariableFilterType = typeof VAR_LEVELS | typeof VAR_FIELDS_AND_METADATA;
export type AdHocFilterTypes = InterpolatedFilterType | typeof VAR_LABELS_REPLICA | typeof VAR_FIELDS_AND_METADATA;

export function clearFilters(
  key: string,
  scene: SceneObject,
  variableType: InterpolatedFilterType,
  value?: string,
  operator?: FilterType
) {
  const variable = getUIAdHocVariable(variableType, key, scene);

  let filters = variable.state.filters.filter((filter) => {
    const fieldValue = getValueFromAdHocVariableFilter(variableType, filter);
    if (value && operator) {
      return !(filter.key === key && fieldValue.value === value && filter.operator === operator);
    }
    if (value) {
      return !(filter.key === key && fieldValue.value === value);
    }
    if (operator) {
      return !(filter.key === key && filter.operator === operator);
    }

    return !(filter.key === key);
  });

  scene.publishEvent(new ClearFilterEvent(key, value, operator), true);

  variable.setState({
    filters,
  });
}

type OperatorType = 'greater' | 'lesser';
const getNumericOperatorType = (op: NumericFilterType | string): OperatorType | undefined => {
  if (op === FilterOp.gt || op === FilterOp.gte) {
    return 'greater';
  }
  if (op === FilterOp.lt || op === FilterOp.lte) {
    return 'lesser';
  }
  return undefined;
};

export function removeNumericFilter(
  key: string,
  scene: SceneObject,
  operator?: NumericFilterType,
  variableType?: InterpolatedFilterType
) {
  if (!variableType) {
    variableType = resolveVariableTypeForField(key, scene);
  }
  const variable = getUIAdHocVariable(variableType, key, scene);
  const operatorType = operator ? getNumericOperatorType(operator) : undefined;

  let filters = variable.state.filters.filter((filter) => {
    return !(
      filter.key === key &&
      (getNumericOperatorType(filter.operator) === operatorType || filter.operator === FilterOp.NotEqual)
    );
  });

  variable.setState({
    filters,
  });
}

export function addNumericFilter(
  key: string,
  value: string,
  operator: NumericFilterType,
  scene: SceneObject,
  variableType?: InterpolatedFilterType
) {
  const operatorType = getNumericOperatorType(operator);

  if (!variableType) {
    variableType = resolveVariableTypeForField(key, scene);
  }
  const variable = getUIAdHocVariable(variableType, key, scene);

  let valueObject: string | undefined = undefined;
  if (variableType === VAR_FIELDS) {
    valueObject = JSON.stringify({
      value,
      parser: getParserForField(key, scene),
    });
  }

  let filters = variable.state.filters.filter((filter) => {
    return !(
      filter.key === key &&
      (getNumericOperatorType(filter.operator) === operatorType || filter.operator === FilterOp.NotEqual)
    );
  });

  filters = [
    ...filters,
    {
      key,
      operator: operator,
      value: valueObject ? valueObject : value,
      valueLabels: [value],
    },
  ];

  variable.setState({
    filters,
  });

  scene.publishEvent(new AddFilterEvent('filterButton', operator, key, value), true);
}

/**
 * Helper for buttons in the UI
 * toggles an ad hoc filter to a given variable type
 */
export function addToFilters(
  key: string,
  value: string,
  operator: FilterType,
  scene: SceneObject,
  variableType: InterpolatedFilterType
) {
  // Add the current url to browser history before the state is changed so the user can revert their change.
  addCurrentUrlToHistory();

  if (variableType === VAR_LABELS) {
    addToFavorites(key, value, scene);
  }

  const variable = getUIAdHocVariable(variableType, key, scene);

  let valueObject: string | undefined = undefined;
  let valueLabel = value;
  if (variableType === VAR_FIELDS) {
    valueObject = JSON.stringify({
      value,
      parser: getParserForField(key, scene),
    });
  } else if (variableType === VAR_LEVELS && operator === 'exclude') {
    valueLabel = `!${value}`;
  }

  // If the filter exists, filter it
  let filters = variable.state.filters.filter((filter) => {
    const fieldValue = getValueFromAdHocVariableFilter(variableType, filter);

    // if we're including, we want to remove all filters that have this key
    if (operator === 'include') {
      return !(filter.key === key && filter.operator === FilterOp.NotEqual);
    }
    if (operator === 'exclude') {
      return !(filter.key === key && filter.operator === FilterOp.Equal);
    }

    return !(filter.key === key && fieldValue.value === value);
  });

  const filterExists = filters.length !== variable.state.filters.length;

  if (operator === 'include' || operator === 'exclude' || (!filterExists && operator === 'toggle')) {
    filters = [
      ...filters,
      {
        key,
        operator: operator === 'exclude' ? FilterOp.NotEqual : FilterOp.Equal,
        value: valueObject ? valueObject : value,
        valueLabels: [valueLabel],
      },
    ];
  }

  // Variable needs to be updated before event is published!
  variable.setState({
    filters,
  });

  scene.publishEvent(new AddFilterEvent('filterButton', operator, key, value), true);
}

export function replaceFilter(
  key: string,
  value: string,
  operator: Extract<FilterType, 'include' | 'exclude'>,
  scene: SceneObject,
  variableType: InterpolatedFilterType
) {
  const variable = getUIAdHocVariable(variableType, key, scene);

  variable.setState({
    filters: [
      {
        key,
        operator: operator === 'exclude' ? FilterOp.NotEqual : FilterOp.Equal,
        value,
      },
    ],
    hide: VariableHide.hideLabel,
  });
}

export function validateVariableNameForField(field: string, variableName: InterpolatedFilterType) {
  // Special case: If the key is LEVEL_VARIABLE_VALUE, we need to use the VAR_FIELDS.
  if (field === LEVEL_VARIABLE_VALUE) {
    return VAR_LEVELS;
  }
  return variableName;
}

function resolveVariableTypeForField(field: string, scene: SceneObject): InterpolatedFilterType {
  const indexedLabel = getDetectedLabelsFrame(scene)?.fields?.find((label) => label.name === field);
  return indexedLabel ? VAR_LABELS : VAR_FIELDS;
}

export class AddToFiltersButton extends SceneObjectBase<AddToFiltersButtonState> {
  constructor(state: AddToFiltersButtonState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const filter = getFilter(this.state.frame);
    if (filter) {
      const variable = getUIAdHocVariable(this.state.variableName, filter.name, this);
      this.setFilterState(variable);

      this._subs.add(
        variable.subscribeToState((newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            this.setFilterState(variable);
          }
        })
      );
    }
  }

  private setFilterState(variable: AdHocFiltersVariable) {
    const filter = getFilter(this.state.frame);
    if (!filter) {
      this.setState({
        isIncluded: false,
        isExcluded: false,
      });
      return;
    }

    // Check if the filter is already there
    const filterInSelectedFilters = variable.state.filters.find((f) => {
      const isMetadata = isFilterMetadata(filter);
      const value = getValueFromAdHocVariableFilter(isMetadata ? VAR_METADATA : VAR_FIELDS, f);
      return f.key === filter.name && value.value === filter.value;
    });

    if (!filterInSelectedFilters) {
      this.setState({
        isIncluded: false,
        isExcluded: false,
      });
      return;
    }

    this.setState({
      isIncluded: filterInSelectedFilters.operator === FilterOp.Equal,
      isExcluded: filterInSelectedFilters.operator === FilterOp.NotEqual,
    });
  }

  public onClick = (type: FilterType) => {
    const filter = getFilter(this.state.frame);
    if (!filter) {
      return;
    }

    addToFilters(filter.name, filter.value, type, this, this.state.variableName);
    const variable = getUIAdHocVariable(this.state.variableName, filter.name, this);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_breakdown_clicked,
      {
        filterType: this.state.variableName,
        key: filter.name,
        action: type,
        filtersLength: variable?.state.filters.length || 0,
      }
    );
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    const { hideExclude, isExcluded, isIncluded } = model.useState();
    return (
      <FilterButton
        buttonFill={'outline'}
        isIncluded={isIncluded ?? false}
        isExcluded={isExcluded ?? false}
        onInclude={() => model.onClick('include')}
        onClear={() => model.onClick('clear')}
        onExclude={() => model.onClick('exclude')}
        hideExclude={hideExclude}
      />
    );
  };
}

const getFilter = (frame: DataFrame) => {
  // current filter name and value is format {name: value}
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  // Sanity check - filter should have only one key-value pair
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    logger.warn('getFilter: unexpected empty labels');
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  const value = filterNameAndValueObj[name];
  return { name, value };
};

const getUIAdHocVariable = (variableType: InterpolatedFilterType, key: string, scene: SceneObject) => {
  return variableType === VAR_FIELDS || variableType === VAR_METADATA
    ? getFieldsAndMetadataVariable(scene)
    : getAdHocFiltersVariable(validateVariableNameForField(key, variableType), scene);
};
