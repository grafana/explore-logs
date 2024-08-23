import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { getLogsPanelFrame, ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';
import { addToFilters } from './AddToFiltersButton';
import { FilterButton } from '../../FilterButton';
import {
  EMPTY_VARIABLE_VALUE,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  LEVEL_VARIABLE_VALUE,
} from '../../../services/variables';
import { AdHocVariableFilter, Field, Labels, LoadingState } from '@grafana/data';
import { FilterOp } from '../../../services/filters';

interface SelectFieldActionSceneState extends SceneObjectState {
  labelName: string;
  fieldType: ValueSlugs;
  hideValueDrilldown?: boolean;
  showFilterField?: boolean;
  variable?: AdHocFiltersVariable;
}

export class SelectLabelActionScene extends SceneObjectBase<SelectFieldActionSceneState> {
  constructor(state: SelectFieldActionSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const { hideValueDrilldown, labelName, showFilterField, variable } = model.useState();
    const existingFilter = model.getExistingFilter(variable);

    return (
      <>
        {variable && showFilterField === true && (
          <FilterButton
            isExcluded={existingFilter?.operator === FilterOp.Equal}
            isIncluded={existingFilter?.operator === FilterOp.NotEqual}
            onInclude={() => model.onClickExcludeEmpty(variable.state.name)}
            onExclude={() => model.onClickIncludeEmpty(variable.state.name)}
            onClear={() => model.clearFilter(variable.state.name)}
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

  private getExistingFilter(variable?: AdHocFiltersVariable): AdHocVariableFilter | undefined {
    return variable?.state.filters.find((filter) => {
      return filter.key === this.state.labelName;
    });
  }

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

  public onClickExcludeEmpty = (variableName: string) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'exclude', this, variableName);
  };

  public onClickIncludeEmpty = (variableName: string) => {
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'include', this, variableName);
  };

  public clearFilter = (variableName: string) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'clear', this, variableName);
  };

  private calculateSparsity() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const logsPanelData = getLogsPanelFrame(serviceScene.state.$data?.state.data);
    const labels: Field<Labels> | undefined = logsPanelData?.fields.find((field) => field.name === 'labels');

    if (!labels || !logsPanelData) {
      this.setState({
        showFilterField: false,
      });
      return;
    }

    let variable: AdHocFiltersVariable;
    if (this.state.fieldType === ValueSlugs.field) {
      variable = getFieldsVariable(this);
    } else if (this.state.labelName === LEVEL_VARIABLE_VALUE) {
      variable = getLevelsVariable(this);
    } else {
      variable = getLabelsVariable(this);
    }
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

    if (logLinesWithLabelCount < logsPanelData.length || this.getExistingFilter(variable)) {
      this.setState({
        showFilterField: true,
        //@todo not clone? set function to get variable to state?
        variable: variable.clone(),
      });
    }
  }
}
