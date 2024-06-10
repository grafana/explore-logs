import React from 'react';

import { DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  sceneGraph,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';

export interface AddToFiltersButtonState extends SceneObjectState {
  frame: DataFrame;
  variableName: string;
}

export class AddToFiltersButton extends SceneObjectBase<AddToFiltersButtonState> {
  public onClick = () => {
    const labels = this.state.frame.fields[1]?.labels ?? {};
    if (Object.keys(labels).length !== 1) {
      return;
    }
    const labelName = Object.keys(labels)[0];

    let variableName = this.state.variableName;
    // If the variable is a level variable, we need to use the VAR_FIELDS variable
    // as that one is detected field
    if (labelName === LEVEL_VARIABLE_VALUE) {
      variableName = VAR_FIELDS;
    }

    const variable = sceneGraph.lookupVariable(variableName, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    // Check if the filter is already there
    const isFilterDuplicate = variable.state.filters.some((f) => {
      return f.key === labelName && f.value === labels[labelName];
    });

    // Only add the unique filters
    if (!isFilterDuplicate) {
      variable.setState({
        filters: [
          ...variable.state.filters,
          {
            key: labelName,
            operator: '=',
            value: labels[labelName],
          },
        ],
        hide: VariableHide.hideLabel,
      });
    }

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.add_to_filters_in_breakdown_clicked,
      {
        filterType: this.state.variableName,
        key: labelName,
        isFilterDuplicate,
        filtersLength: variable.state.filters.length,
      }
    );
  };

  public static Component = ({ model }: SceneComponentProps<AddToFiltersButton>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Add to filters
      </Button>
    );
  };
}
