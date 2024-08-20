import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';
import { addToFilters } from './AddToFiltersButton';
import { FilterButton } from '../../FilterButton';
import { getFieldsVariable } from '../../../services/variables';

interface SelectFieldActionSceneState extends SceneObjectState {
  labelName: string;
  hideValueDrilldown?: boolean;
}

export class SelectFieldActionScene extends SceneObjectBase<SelectFieldActionSceneState> {
  public static Component = ({ model }: SceneComponentProps<SelectFieldActionScene>) => {
    const fields = getFieldsVariable(model);
    const existingFilter = fields.state.filters.find((filter) => {
      return filter.key === model.state.labelName;
    });

    return (
      <>
        <FilterButton
          isExcluded={existingFilter?.operator === '='}
          isIncluded={existingFilter?.operator === '!='}
          onInclude={model.onClickExcludeEmpty}
          onExclude={model.onClickIncludeEmpty}
          onClear={model.clearFilter}
          titles={{
            include: 'Only show logs that contain this field',
            exclude: 'Hide all logs that contain this field',
          }}
        />

        {model.state.hideValueDrilldown !== true && (
          <Button
            title={'View breakdown of values for this field'}
            variant="secondary"
            size="sm"
            onClick={model.onClickViewValues}
            aria-label={`Select ${model.useState().labelName}`}
          >
            Values
          </Button>
        )}
      </>
    );
  };

  public onClickViewValues = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.field, this.state.labelName, serviceScene);
  };

  public onClickExcludeEmpty = () => {
    addToFilters(this.state.labelName, '""', 'exclude', this);
  };

  public onClickIncludeEmpty = () => {
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, '""', 'include', this);
  };

  public clearFilter = () => {
    addToFilters(this.state.labelName, '""', 'clear', this);
  };
}
