import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { navigateToInitialPageAfterServiceSelection } from '../../services/navigate';
import { getLabelsVariable } from '../../services/variableGetters';
import { FilterOp } from '../../services/filterTypes';
import { testIds } from '../../services/testIds';

export interface ShowLogsButtonSceneState extends SceneObjectState {
  disabled?: boolean;
  hide?: boolean;
}
export class ShowLogsButtonScene extends SceneObjectBase<ShowLogsButtonSceneState> {
  constructor(state: Partial<ShowLogsButtonSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    const labelsVar = getLabelsVariable(this);
    labelsVar.subscribeToState((newState) => {
      const hasPositiveFilter = !!newState.filters.find((f) => f.operator === FilterOp.Equal);
      this.setState({
        disabled: !hasPositiveFilter,
      });
    });
  }

  onClick = () => {
    const labelsVar = getLabelsVariable(this);
    const positiveFilter = labelsVar.state.filters.find((f) => f.operator === FilterOp.Equal);

    if (positiveFilter) {
      navigateToInitialPageAfterServiceSelection(positiveFilter.key, positiveFilter.value);
    }
  };

  static Component = ({ model }: SceneComponentProps<ShowLogsButtonScene>) => {
    const { disabled, hide } = model.useState();
    const styles = useStyles2(getStyles);

    if (hide === true) {
      return <></>;
    }

    return (
      <Button
        data-testid={testIds.index.header.showLogsButton}
        disabled={disabled}
        fill={'outline'}
        className={styles.button}
        onClick={model.onClick}
      >
        Show logs
      </Button>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    button: css({
      [theme.breakpoints.down('lg')]: {
        alignSelf: 'flex-end',
      },
      [theme.breakpoints.down('md')]: {
        marginTop: theme.spacing(1),
        alignSelf: 'flex-start',
      },

      alignSelf: 'flex-start',
      marginTop: '22px',
    }),
  };
}
