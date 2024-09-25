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
import { getPrimaryLabelFromUrl, ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';
import { addToFilters, VariableFilterType } from './AddToFiltersButton';
import { FilterButton } from '../../FilterButton';
import {
  EMPTY_VARIABLE_VALUE,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getValueFromAdHocVariableFilter,
  LEVEL_VARIABLE_VALUE,
} from '../../../services/variables';
import { AdHocVariableFilter, Field, Labels, LoadingState } from '@grafana/data';
import { FilterOp } from '../../../services/filters';

interface SelectLabelActionSceneState extends SceneObjectState {
  labelName: string;
  fieldType: ValueSlugs;
  hideValueDrilldown?: boolean;
  showFilterField?: boolean;
}

export class SelectLabelActionScene extends SceneObjectBase<SelectLabelActionSceneState> {
  constructor(state: SelectLabelActionSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const { hideValueDrilldown, labelName, showFilterField } = model.useState();
    const variable = model.getVariable();
    const variableName = variable.useState().name as VariableFilterType;
    const existingFilter = model.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variable, existingFilter);
    const value = fieldValue?.value;

    return (
      <>
        {showFilterField === true && (
          <FilterButton
            isExcluded={existingFilter?.operator === FilterOp.Equal && value === EMPTY_VARIABLE_VALUE}
            isIncluded={existingFilter?.operator === FilterOp.NotEqual && value === EMPTY_VARIABLE_VALUE}
            onInclude={() => model.onClickExcludeEmpty(variableName)}
            onExclude={() => model.onClickIncludeEmpty(variableName)}
            onClear={() => model.clearFilter(variableName)}
            buttonFill={'text'}
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
    let { labelName } = getPrimaryLabelFromUrl();
    if (this.state.labelName !== labelName) {
      return variable?.state.filters.find((filter) => {
        const value = getValueFromAdHocVariableFilter(variable, filter);
        return filter.key === this.state.labelName && value.value === EMPTY_VARIABLE_VALUE;
      });
    }

    return undefined;
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

  public onClickExcludeEmpty = (variableType: VariableFilterType) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'exclude', this, variableType);
  };

  public onClickIncludeEmpty = (variableType: VariableFilterType) => {
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'include', this, variableType);
  };

  public clearFilter = (variableType: VariableFilterType) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'clear', this, variableType);
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
    const variable = this.getVariable();
    // iterate through all the labels on the log panel query result and count how many times this exists
    const logLinesWithLabelCount = labels.values.reduce((acc, labels) => {
      if (labels?.[this.state.labelName]) {
        acc++;
      }
      return acc;
    }, 0);

    const panel = sceneGraph.getAncestor(this, VizPanel);
    if (logLinesWithLabelCount !== undefined && logsPanelData.length > 0) {
      const percentage = ((logLinesWithLabelCount / logsPanelData.length) * 100).toLocaleString();
      const description = `${this.state.labelName} exists on ${percentage}% of ${logsPanelData.length} sampled log lines`;

      // Update the desc
      panel.setState({
        description,
      });
    } else {
      panel.setState({
        description: undefined,
      });
    }

    if (logLinesWithLabelCount < logsPanelData.length || this.getExistingFilter(variable)) {
      this.setState({
        showFilterField: true,
      });
    } else {
      this.setState({
        showFilterField: false,
      });
    }
  }

  private getVariable() {
    if (this.state.fieldType === ValueSlugs.field) {
      return getFieldsVariable(this);
    } else if (this.state.labelName === LEVEL_VARIABLE_VALUE) {
      return getLevelsVariable(this);
    } else {
      return getLabelsVariable(this);
    }
  }
}
