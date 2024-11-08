import React from 'react';

import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { VariableHide } from '@grafana/schema';
import { addToFavoriteLabelValueInStorage } from 'services/store';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { navigateToInitialPageAfterServiceSelection } from '../../services/navigate';
import { getDataSourceVariable, getLabelsVariable } from '../../services/variableGetters';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { FilterOp } from '../../services/filterTypes';

export interface SelectServiceButtonState extends SceneObjectState {
  labelValue: string;
  labelName: string;
}
export function selectLabel(primaryLabelName: string, primaryLabelValue: string, sceneRef: SceneObject) {
  const variable = getLabelsVariable(sceneRef);

  reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.service_selected, {
    value: primaryLabelValue,
    label: primaryLabelName,
  });

  variable.setState({
    filters: [
      ...variable.state.filters.filter((f) => f.key !== primaryLabelName),
      {
        key: primaryLabelName,
        operator: FilterOp.Equal,
        value: primaryLabelValue,
      },
    ],
    hide: VariableHide.hideLabel,
  });
  const ds = getDataSourceVariable(sceneRef).getValue();

  if (primaryLabelName === SERVICE_NAME) {
    primaryLabelName = SERVICE_UI_LABEL;
  }

  addToFavoriteLabelValueInStorage(ds, primaryLabelName, primaryLabelValue);

  // In this case, we don't have a ServiceScene created yet, so we call a special function to navigate there for the first time
  navigateToInitialPageAfterServiceSelection(primaryLabelName, primaryLabelValue);
}

export class SelectServiceButton extends SceneObjectBase<SelectServiceButtonState> {
  public onClick = () => {
    if (!this.state.labelValue) {
      return;
    }
    selectLabel(this.state.labelName, this.state.labelValue, this);
  };

  public static Component = ({ model }: SceneComponentProps<SelectServiceButton>) => {
    const styles = useStyles2(getStyles);
    return (
      <Button
        tooltip={`View breakdown for ${model.state.labelValue}`}
        className={styles.button}
        variant="secondary"
        size="sm"
        onClick={model.onClick}
      >
        Select
      </Button>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      alignSelf: 'center',
    }),
  };
}
