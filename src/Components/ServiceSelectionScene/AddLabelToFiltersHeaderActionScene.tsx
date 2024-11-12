import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { testIds } from '../../services/testIds';
import { addToFilters, FilterType } from '../ServiceScene/Breakdowns/AddToFiltersButton';
import { VAR_LABELS } from '../../services/variables';
import { getLabelsVariable, getValueFromAdHocVariableFilter } from '../../services/variableGetters';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { css } from '@emotion/css';
import React from 'react';
import { FilterOp } from '../../services/filterTypes';

export interface AddLabelToFiltersHeaderActionSceneState extends SceneObjectState {
  name: string;
  value: string;
  isIncluded?: boolean;
  isExcluded?: boolean;
}

export class AddLabelToFiltersHeaderActionScene extends SceneObjectBase<AddLabelToFiltersHeaderActionSceneState> {
  constructor(state: AddLabelToFiltersHeaderActionSceneState) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({ ...this.isSelected() });
    this._subs.add(
      getLabelsVariable(this).subscribeToState(() => {
        const selected = this.isSelected();
        if (this.state.isIncluded !== selected.isIncluded || this.state.isExcluded !== selected.isExcluded) {
          this.setState({ ...selected });
        }
      })
    );
  }

  isSelected = () => {
    const variable = getLabelsVariable(this);

    // Check if the filter is already there
    const filterInSelectedFilters = variable.state.filters.find((f) => {
      const value = getValueFromAdHocVariableFilter(variable, f);
      return f.key === this.state.name && value.value === this.state.value;
    });

    if (!filterInSelectedFilters) {
      return { isIncluded: false, isExcluded: false };
    }

    return {
      isIncluded: filterInSelectedFilters.operator === FilterOp.Equal,
      isExcluded: filterInSelectedFilters.operator === FilterOp.NotEqual,
    };
  };

  public static Component = ({ model }: SceneComponentProps<AddLabelToFiltersHeaderActionScene>) => {
    const { value, isIncluded } = model.useState();

    const styles = useStyles2(getStyles);
    return (
      <span className={styles.wrapper}>
        <Button
          tooltip={isIncluded ? `Remove ${value} from filters` : `Add ${value} to filters`}
          variant={'secondary'}
          fill={'outline'}
          icon={isIncluded ? 'minus' : 'plus'}
          size="sm"
          aria-selected={isIncluded}
          className={styles.includeButton}
          onClick={() => (isIncluded ? model.onClick('clear') : model.onClick('include'))}
          data-testid={testIds.exploreServiceDetails.buttonFilterInclude}
        />
      </span>
    );
  };

  public getFilter() {
    return { name: this.state.name, value: this.state.value };
  }

  public onClick = (type: FilterType) => {
    const filter = this.getFilter();

    addToFilters(filter.name, filter.value, type, this, VAR_LABELS);

    const variable = getLabelsVariable(this);
    reportAppInteraction(USER_EVENTS_PAGES.service_selection, USER_EVENTS_ACTIONS.service_selection.add_to_filters, {
      filterType: 'index-filters',
      key: filter.name,
      action: type,
      filtersLength: variable?.state.filters.length || 0,
    });

    this.setState({ ...this.isSelected() });
  };
}

const getStyles = () => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
    }),
    includeButton: css({
      borderRadius: 0,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignSelf: 'center',
    }),
  };
};