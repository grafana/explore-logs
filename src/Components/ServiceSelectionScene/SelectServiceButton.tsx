import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneCSSGridItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { addToFavoriteServicesInStorage } from 'services/store';
import { getDataSourceVariable, getLabelsVariable } from 'services/variables';
import { SERVICE_NAME, ServiceSelectionScene } from './ServiceSelectionScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { FilterOp } from 'services/filters';
import { navigateToInitialPageAfterServiceSelection } from '../../services/navigate';
import { updateParserFromDataFrame } from '../../services/fields';

export interface SelectServiceButtonState extends SceneObjectState {
  service: string;
}

function setParserIfFrameExistsForService(service: string, sceneRef: SceneObject) {
  const serviceSelectionScene = sceneGraph.getAncestor(sceneRef, ServiceSelectionScene);

  const gridItem: SceneCSSGridItem | SceneObject | undefined = serviceSelectionScene.state.body.state.children.find(
    (child) => {
      if (child instanceof SceneCSSGridItem) {
        const body = child.state.body;

        // The query runner is only defined for the logs panel
        const queryRunner = body?.state.$data;
        if (queryRunner instanceof SceneQueryRunner) {
          return queryRunner?.state?.queries?.find((query) => {
            return query.refId === `logs-${service}`;
          });
        }
      }
      return false;
    }
  );

  if (gridItem && gridItem instanceof SceneCSSGridItem) {
    const body = gridItem.state.body as VizPanel;
    const frame = body.state.$data?.state.data?.series[0];

    if (frame) {
      updateParserFromDataFrame(frame, sceneRef);
    }
  }
}

export function selectService(service: string, sceneRef: SceneObject) {
  const variable = getLabelsVariable(sceneRef);
  if (!(variable instanceof AdHocFiltersVariable)) {
    return;
  }

  reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.service_selected, {
    service: service,
  });

  setParserIfFrameExistsForService(service, sceneRef);

  const serviceSelectionScene = sceneGraph.getAncestor(sceneRef, ServiceSelectionScene);
  // Setting the service variable state triggers a re-query of the services with invalid queries, so we clear out the body state to avoid triggering queries since
  serviceSelectionScene.setState({
    servicesToQuery: undefined,
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
  const ds = getDataSourceVariable(sceneRef)?.getValue();
  addToFavoriteServicesInStorage(ds, service);

  // In this case, we don't have a ServiceScene created yet, so we call a special function to navigate there for the first time
  navigateToInitialPageAfterServiceSelection(service);
}

export class SelectServiceButton extends SceneObjectBase<SelectServiceButtonState> {
  public onClick = () => {
    const variable = getLabelsVariable(this);
    if (!variable || !this.state.service) {
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
