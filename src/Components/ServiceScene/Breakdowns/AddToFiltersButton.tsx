import React from 'react';

import { AdHocVariableFilter, DataFrame } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, SceneObject, sceneGraph } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { getAdHocFiltersVariable, LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS } from 'services/variables';
import { FilterButton } from 'Components/FilterButton';
import { FilterOp } from 'services/filters';
import { ServiceScene } from '../ServiceScene';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: string;
}

/**
 * Filter types:
 * - include/exclude: add a negative or positive filter
 * - clear: remove filter if exists
 * - toggle: if the filter does not exist, add as include; if exists, remove
 */
export type FilterType = 'include' | 'clear' | 'exclude' | 'toggle';

export function addAdHocFilter(filter: AdHocVariableFilter, scene: SceneObject, variableName?: string) {
  const type: FilterType = filter.operator === '=' ? 'include' : 'exclude';
  addToFilters(filter.key, filter.value, type, scene, variableName);
}

export function addToFilters(
  key: string,
  value: string,
  operator: FilterType,
  scene: SceneObject,
  variableName?: string
) {
  if (!variableName) {
    variableName = resolveVariableNameForField(key, scene);
  }

  const variable = getAdHocFiltersVariable(validateVariableNameForField(key, variableName), scene);

  // If the filter exists, filter it
  let filters = variable.state.filters.filter((filter) => {
    return !(filter.key === key && filter.value === value);
  });

  const filterExists = filters.length !== variable.state.filters.length;

  if (operator === 'include' || operator === 'exclude' || (!filterExists && operator === 'toggle')) {
    filters = [
      ...filters,
      {
        key,
        operator: operator === 'exclude' ? FilterOp.NotEqual : FilterOp.Equal,
        value,
      },
    ];
  }

  variable.setState({
    filters,
    hide: VariableHide.hideLabel,
  });
}

function validateVariableNameForField(field: string, variableName: string) {
  // Special case: If the key is LEVEL_VARIABLE_VALUE, we need to use the VAR_FIELDS.
  if (field === LEVEL_VARIABLE_VALUE) {
    return VAR_LEVELS;
  }
  return variableName;
}

function resolveVariableNameForField(field: string, scene: SceneObject) {
  const serviceScene = sceneGraph.getAncestor(scene, ServiceScene);
  const indexedLabel = serviceScene.state.labels?.find((label) => label.label === field);
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
      return f.key === filter.name && f.value === filter.value;
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
