import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { addToFavoriteServicesInStorage } from 'services/store';
import { VAR_DATASOURCE, VAR_LABELS } from 'services/variables';
import { SERVICE_NAME } from './ServiceSelectionScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { FilterOp } from 'services/filters';
import { navigateToInitialPageAfterServiceSelection } from '../../services/navigate';

export interface SelectServiceButtonState extends SceneObjectState {
  service: string;
}

export function selectService(service: string, sceneRef: SceneObject) {
  const variable = sceneGraph.lookupVariable(VAR_LABELS, sceneRef);
  if (!(variable instanceof AdHocFiltersVariable)) {
    return;
  }

  reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.service_selected, {
    service: service,
  });

  variable.setState({
    filters: [
      ...variable.state.filters.filter((f) => f.key !== SERVICE_NAME),
      {
        key: SERVICE_NAME,
        operator: FilterOp.Equal,
        value: service,
      },
    ],
    hide: VariableHide.hideLabel,
  });
  const ds = sceneGraph.lookupVariable(VAR_DATASOURCE, sceneRef)?.getValue();
  addToFavoriteServicesInStorage(ds, service);

  // In this case, we don't have a ServiceScene created yet, so we call a special function to navigate there for the first time
  navigateToInitialPageAfterServiceSelection(service);
}

export class SelectServiceButton extends SceneObjectBase<SelectServiceButtonState> {
  public onClick = () => {
    const variable = sceneGraph.lookupVariable(VAR_LABELS, this);
    if (!(variable instanceof AdHocFiltersVariable)) {
      return;
    }

    if (!this.state.service) {
      return;
    }
    selectService(this.state.service, this);
  };

  public static Component = ({ model }: SceneComponentProps<SelectServiceButton>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        Select
      </Button>
    );
  };
}
