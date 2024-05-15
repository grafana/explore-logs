import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { addToFavoriteServicesInStorage } from 'services/store';
import { VAR_DATASOURCE, VAR_FILTERS } from 'services/variables';
import { SERVICE_NAME, StartingPointSelectedEvent } from './ServiceSelectionScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';

export interface SelectServiceButtonState extends SceneObjectState {
  service: string;
}

export class SelectServiceButton extends SceneObjectBase<SelectServiceButtonState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable(VAR_FILTERS, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    if (!this.state.service) {
      return;
    }

    reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.service_selected, {
      service: this.state.service,
    });

    variable.setState({
      filters: [
        ...variable.state.filters.filter((f) => f.key !== SERVICE_NAME),
        {
          key: SERVICE_NAME,
          operator: '=',
          value: this.state.service,
        },
      ],
      hide: VariableHide.hideLabel,
    });
    const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, this)?.getValue();
    addToFavoriteServicesInStorage(ds, this.state.service);

    this.publishEvent(new StartingPointSelectedEvent(), true);
  };

  public static Component = ({ model }: SceneComponentProps<SelectServiceButton>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
