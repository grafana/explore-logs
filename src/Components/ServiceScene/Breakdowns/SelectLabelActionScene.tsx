import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { getLogsPanelFrame, ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';
import { addToFilters } from './AddToFiltersButton';
import { FilterButton } from '../../FilterButton';
import { getFieldsVariable } from '../../../services/variables';
import { Field, Labels, LoadingState } from '@grafana/data';

interface SelectFieldActionSceneState extends SceneObjectState {
  labelName: string;
  fieldType: ValueSlugs;
  hideValueDrilldown?: boolean;
  showFilterField?: boolean;
}

export class SelectLabelActionScene extends SceneObjectBase<SelectFieldActionSceneState> {
  constructor(state: SelectFieldActionSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const { hideValueDrilldown, labelName, showFilterField } = model.useState();
    const fields = getFieldsVariable(model);
    const existingFilter = fields.state.filters.find((filter) => {
      return filter.key === model.state.labelName;
    });

    return (
      <>
        {showFilterField === true && (
          <FilterButton
            isExcluded={existingFilter?.operator === '='}
            isIncluded={existingFilter?.operator === '!='}
            onInclude={model.onClickExcludeEmpty}
            onExclude={model.onClickIncludeEmpty}
            onClear={model.clearFilter}
            titles={{
              include: `Only show logs that contain ${labelName}`,
              exclude: `Hide all logs that contain ${labelName}`,
            }}
          />
        )}

        {hideValueDrilldown !== true && (
          <Button
            title={`View breakdown of values for ${labelName}`}
            variant="primary"
            fill="outline"
            size="sm"
            onClick={model.onClickViewValues}
            aria-label={`Select ${labelName}`}
          >
            Select
          </Button>
        )}
      </>
    );
  };

  public onActivate() {
    this._subs.add(
      sceneGraph.getData(this).subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
          if (serviceScene.state.$data?.state.data?.state === LoadingState.Done) {
            this.calculateSparsity();
          }

          this._subs.add(
            serviceScene.state.$data?.subscribeToState((newLogsPanelState) => {
              if (newLogsPanelState.data?.state === LoadingState.Done) {
                this.calculateSparsity();
              }
            })
          );
        }
      })
    );
  }

  public onClickViewValues = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(this.state.fieldType, this.state.labelName, serviceScene);
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

  private calculateSparsity() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const logsPanelData = getLogsPanelFrame(serviceScene.state.$data?.state.data);
    const labels: Field<Labels> | undefined = logsPanelData?.fields.find((field) => field.name === 'labels');

    if (labels && logsPanelData) {
      // iterate through all the labels on the log panel query result and count how many times this exists
      const logLinesWithLabelCount = labels.values.reduce((acc, labels) => {
        if (labels?.[this.state.labelName]) {
          acc++;
        }
        return acc;
      }, 0);

      const panel = sceneGraph.getAncestor(this, VizPanel);
      const percentage = ((logLinesWithLabelCount / logsPanelData.length) * 100).toLocaleString();
      const description = `${this.state.labelName} exists on ${percentage}% of ${logsPanelData.length} sampled log lines`;

      // Update the desc
      panel.setState({
        description,
      });

      if (logLinesWithLabelCount < logsPanelData.length) {
        this.setState({
          showFilterField: true,
        });
      } else {
        this.setState({
          showFilterField: false,
        });
      }
    }
  }
}
