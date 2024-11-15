import React from 'react';

import { AdHocVariableFilter, BusEventBase, DataFrame } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from 'services/variables';
import { FilterButton } from 'Components/FilterButton';
import { getDetectedLabelsFrame } from '../ServiceScene';
import { getParserForField } from '../../../services/fields';
import { getAdHocFiltersVariable, getValueFromAdHocVariableFilter } from '../../../services/variableGetters';
import { FilterOp } from '../../../services/filterTypes';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: VariableFilterType;
}

export class AddFilterEvent extends BusEventBase {
  constructor(public operator: FilterType, public key: string, public value: string) {
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

/**
 * Filter types:
 * - include/exclude: add a negative or positive filter
 * - clear: remove filter if exists
 * - toggle: if the filter does not exist, add as include; if exists, remove
 */
export type FilterType = 'include' | 'clear' | 'exclude' | 'toggle';

export function addAdHocFilter(filter: AdHocVariableFilter, scene: SceneObject, variableType?: VariableFilterType) {
  const type: FilterType = filter.operator === '=' ? 'include' : 'exclude';
  addToFilters(filter.key, filter.value, type, scene, variableType);
}

export type VariableFilterType = typeof VAR_LABELS | typeof VAR_FIELDS | typeof VAR_LEVELS | typeof VAR_METADATA;

export function clearFilters(
  key: string,
  scene: SceneObject,
  variableType?: VariableFilterType,
  value?: string,
  operator?: FilterType
) {
  if (!variableType) {
    variableType = resolveVariableTypeForField(key, scene);
  }
  const variable = getAdHocFiltersVariable(validateVariableNameForField(key, variableType), scene);

  let filters = variable.state.filters.filter((filter) => {
    const fieldValue = getValueFromAdHocVariableFilter(variable, filter);
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

export function addToFilters(
  key: string,
  value: string,
  operator: FilterType,
  scene: SceneObject,
  variableType?: VariableFilterType
) {
  if (!variableType) {
    variableType = resolveVariableTypeForField(key, scene);
  }

  const variable = getAdHocFiltersVariable(validateVariableNameForField(key, variableType), scene);

  let valueObject: string | undefined = undefined;
  if (variableType === VAR_FIELDS) {
    valueObject = JSON.stringify({
      value,
      parser: getParserForField(key, scene),
    });
  }

  // If the filter exists, filter it
  let filters = variable.state.filters.filter((filter) => {
    const fieldValue = getValueFromAdHocVariableFilter(variable, filter);
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
        valueLabels: [value],
      },
    ];
  }

  scene.publishEvent(new AddFilterEvent(operator, key, value), true);

  variable.setState({
    filters,
  });
}

export function replaceFilter(
  key: string,
  value: string,
  operator: Extract<FilterType, 'include' | 'exclude'>,
  scene: SceneObject
) {
  const variable = getAdHocFiltersVariable(
    validateVariableNameForField(key, resolveVariableTypeForField(key, scene)),
    scene
  );

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

export function validateVariableNameForField(field: string, variableName: string) {
  // Special case: If the key is LEVEL_VARIABLE_VALUE, we need to use the VAR_FIELDS.
  if (field === LEVEL_VARIABLE_VALUE) {
    return VAR_LEVELS;
  }
  return variableName;
}

function resolveVariableTypeForField(field: string, scene: SceneObject): VariableFilterType {
  const indexedLabel = getDetectedLabelsFrame(scene)?.fields?.find((label) => label.name === field);
  return indexedLabel ? VAR_LABELS : VAR_FIELDS;
}

export class AddToFiltersButton extends SceneObjectBase<AddToFiltersButtonState> {
  public onClick = (type: FilterType) => {
    const filter = getFilter(this.state.frame);
    if (!filter) {
      return;
    }

    addToFilters(filter.name, filter.value, type, this, this.state.variableName);

    const variable = getAdHocFiltersVariable(validateVariableNameForField(filter.name, this.state.variableName), this);
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

  isSelected = () => {
    const filter = getFilter(this.state.frame);
    if (!filter) {
      return { isIncluded: false, isExcluded: false };
    }

    const variable = getAdHocFiltersVariable(validateVariableNameForField(filter.name, this.state.variableName), this);

    // Check if the filter is already there
    const filterInSelectedFilters = variable.state.filters.find((f) => {
      const value = getValueFromAdHocVariableFilter(variable, f);
      return f.key === filter.name && value.value === filter.value;
    });

    if (!filterInSelectedFilters) {
      return { isIncluded: false, isExcluded: false };
    }

    return {
      isIncluded: filterInSelectedFilters.operator === FilterOp.Equal,
      isExcluded: filterInSelectedFilters.operator === FilterOp.NotEqual,
    };
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    const { isIncluded, isExcluded } = model.isSelected();
    return (
      <FilterButton
        buttonFill={'outline'}
        isIncluded={isIncluded}
        isExcluded={isExcluded}
        onInclude={() => model.onClick('include')}
        onClear={() => model.onClick('clear')}
        onExclude={() => model.onClick('exclude')}
      />
    );
  };
}

const getFilter = (frame: DataFrame) => {
  // current filter name and value is format {name: value}
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  // Sanity check - filter should have only one key-value pair
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  const value = filterNameAndValueObj[name];
  return { name, value };
};
