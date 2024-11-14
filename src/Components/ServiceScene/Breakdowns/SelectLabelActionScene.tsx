import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { getLogsPanelFrame, ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { getPrimaryLabelFromUrl, ValueSlugs } from '../../../services/routing';
import { Button, ButtonGroup, ButtonSelect, IconButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { addToFilters, clearFilters, VariableFilterType } from './AddToFiltersButton';
import { EMPTY_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import { AdHocVariableFilter, Field, GrafanaTheme2, Labels, LoadingState, SelectableValue } from '@grafana/data';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getValueFromAdHocVariableFilter,
} from '../../../services/variableGetters';
import { FilterOp } from '../../../services/filterTypes';
import { LokiQuery } from '../../../services/lokiQuery';
import { css } from '@emotion/css';

interface SelectLabelActionSceneState extends SceneObjectState {
  labelName: string;
  fieldType: ValueSlugs;
  hideValueDrilldown?: boolean;
  showSparseFilters?: boolean;
  showNumericFilters?: boolean;
  selectedValue?: SelectableValue<string>;
}

const INCLUDE_VALUE = 'Include';
const EXCLUDE_VALUE = 'Exclude';
const NUMERIC_FILTER_VALUE = 'Add to filter';

export class SelectLabelActionScene extends SceneObjectBase<SelectLabelActionSceneState> {
  constructor(state: SelectLabelActionSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  onChange(value: SelectableValue<string>) {
    const variable = this.getVariable();
    const variableName = variable.state.name as VariableFilterType;
    const existingFilter = this.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variable, existingFilter);
    const isIncluded = existingFilter?.operator === FilterOp.NotEqual && fieldValue.value === EMPTY_VARIABLE_VALUE;

    if (isIncluded && value.value === INCLUDE_VALUE) {
      this.clearFilter(variableName);
    } else if (value.value === INCLUDE_VALUE) {
      this.onClickExcludeEmpty(variableName);
    } else if (value.value === EXCLUDE_VALUE) {
      this.onClickIncludeEmpty(variableName);
    }

    this.setState({
      selectedValue: value,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const { hideValueDrilldown, labelName, showSparseFilters, showNumericFilters, selectedValue } = model.useState();
    const variable = model.getVariable();
    const variableName = variable.useState().name as VariableFilterType;
    const existingFilter = model.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variable, existingFilter);
    const styles = useStyles2(getStyles);

    const isIncluded = existingFilter?.operator === FilterOp.NotEqual && fieldValue.value === EMPTY_VARIABLE_VALUE;
    const hasOtherFilter = !!existingFilter;

    const sparseIncludeOption: SelectableValue<string> = {
      value: INCLUDE_VALUE,
      component: () => <span className={styles.description}>Include all log lines with {labelName}</span>,
    };
    const sparseExcludeOption: SelectableValue<string> = {
      value: EXCLUDE_VALUE,
      component: () => <span className={styles.description}>Exclude all log lines with {labelName}</span>,
    };
    const numericFilterOption: SelectableValue<string> = {
      value: NUMERIC_FILTER_VALUE,
      component: () => <span className={styles.description}>{`Add an expression, i.e. ${labelName} > 30`}</span>,
    };

    const options: Array<SelectableValue<string>> = [];
    if (showSparseFilters) {
      options.push(sparseIncludeOption, sparseExcludeOption);
    }

    if (showNumericFilters) {
      options.push(numericFilterOption);
    }

    const defaultOption = isIncluded
      ? sparseIncludeOption
      : showNumericFilters
      ? numericFilterOption
      : sparseIncludeOption;

    return (
      <>
        {hasOtherFilter && (
          <IconButton
            name={'filter'}
            tooltip={`clear ${labelName} filters`}
            onClick={() => model.clearFilters(variableName)}
          />
        )}
        {(showNumericFilters || showSparseFilters) && (
          <>
            <ButtonGroup>
              <Button
                onClick={() => model.onChange(selectedValue ?? defaultOption)}
                size={'sm'}
                fill={'outline'}
                variant={'secondary'}
              >
                {selectedValue?.value ?? defaultOption.value}
              </Button>
              <ButtonSelect
                className={styles.buttonSelect}
                variant={'default'}
                options={options}
                onChange={(value) => {
                  model.onChange(value);
                }}
              />
            </ButtonGroup>
          </>
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
        // const value = getValueFromAdHocVariableFilter(variable, filter);
        return filter.key === this.state.labelName;
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
    console.log('onClickExcludeEmpty');
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'exclude', this, variableType);
  };

  public onClickIncludeEmpty = (variableType: VariableFilterType) => {
    console.log('onClickIncludeEmpty');
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'include', this, variableType);
  };

  public clearFilter = (variableType: VariableFilterType) => {
    addToFilters(this.state.labelName, EMPTY_VARIABLE_VALUE, 'clear', this, variableType);
  };

  public clearFilters = (variableType: VariableFilterType) => {
    clearFilters(this.state.labelName, this, variableType);
  };

  private calculateSparsity() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const logsPanelData = getLogsPanelFrame(serviceScene.state.$data?.state.data);
    const labels: Field<Labels> | undefined = logsPanelData?.fields.find((field) => field.name === 'labels');

    const data = sceneGraph.getData(this);
    const queryRunner = sceneGraph.findObject(data, (o) => o instanceof SceneQueryRunner) as SceneQueryRunner;
    if (queryRunner) {
      const queries = queryRunner.state.queries;
      const query = queries[0] as LokiQuery | undefined;
      if (query?.expr.includes('avg_over_time')) {
        this.setState({
          showNumericFilters: true,
        });
      }
    }

    if (!labels || !logsPanelData) {
      this.setState({
        showSparseFilters: false,
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
        showSparseFilters: true,
      });
    } else {
      this.setState({
        showSparseFilters: false,
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

const getStyles = (theme: GrafanaTheme2) => {
  return {
    description: css({
      textAlign: 'left',
      fontSize: theme.typography.pxToRem(12),
    }),

    buttonSelect: css({
      border: `1px solid ${theme.colors.border.strong}`,
      borderLeft: 'none',
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
      padding: 1,
      height: '24px',
    }),
  };
};
