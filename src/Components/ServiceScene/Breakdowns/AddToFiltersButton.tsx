import React from 'react';

import { DataFrame } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { VariableHide } from '@grafana/schema';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';
import { FilterButton } from 'Components/FilterButton';
import { getAdHocFiltersVariable } from 'services/scenes';
import { FilterOp } from 'Components/IndexScene/IndexScene';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: string;
}

type FilterType = 'include' | 'reset' | 'exclude';

export class AddToFiltersButton extends SceneObjectBase<AddToFiltersButtonState> {
  public onClick = (type: FilterType) => {
    const selectedFilter = getFilter(this.state.frame);
    if (!selectedFilter) {
      return;
    }

    let variableName = this.state.variableName;

    // If the variable is a LEVEL_VARIABLE_VALUE, we need to use the VAR_FIELDS variable
    // as that one is detected field
    if (selectedFilter.name === LEVEL_VARIABLE_VALUE) {
      variableName = VAR_FIELDS;
    }
    const variable = getAdHocFiltersVariable(variableName, this);
    if (!variable) {
      return;
    }

    // In a case filter is already there, remove it
    let filters = variable.state.filters.filter((f) => {
      return !(f.key === selectedFilter.name && f.value === selectedFilter.value);
    });

    // If type is included or excluded, then add the filter
    if (type === 'include' || type === 'exclude') {
      filters = [
        ...filters,
        {
          key: selectedFilter.name,
          operator: type === 'include' ? FilterOp.Equal : FilterOp.NotEqual,
          value: selectedFilter.value,
        },
      ];
    }

    variable.setState({
      filters,
      hide: VariableHide.hideLabel,
    });

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_breakdown_clicked,
      {
        filterType: this.state.variableName,
        key: selectedFilter.name,
        action: filters.length === variable.state.filters.length ? 'added' : 'removed',
        filtersLength: variable.state.filters.length,
      }
    );
  };

  isSelected = () => {
    const filter = getFilter(this.state.frame);
    if (!filter) {
      return { isIncluded: false, isExcluded: false };
    }

    let variableName = this.state.variableName;
    // If the variable is a LEVEL_VARIABLE_VALUE, we need to use the VAR_FIELDS variable
    // as that one is detected field
    if (filter.name === LEVEL_VARIABLE_VALUE) {
      variableName = VAR_FIELDS;
    }
    const variable = getAdHocFiltersVariable(variableName, this);
    if (!variable) {
      return { isIncluded: false, isExcluded: false };
    }

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
        onReset={() => model.onClick('reset')}
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
