import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { getDetectedFieldsFrame, getLogsPanelFrame, ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { getPrimaryLabelFromUrl, ValueSlugs } from '../../../services/routing';
import { Button, ButtonGroup, ButtonSelect, IconButton, Popover, PopoverController, useStyles2 } from '@grafana/ui';
import React, { useRef } from 'react';
import { addToFilters, clearFilters, VariableFilterType } from './AddToFiltersButton';
import { EMPTY_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE, VAR_FIELDS } from '../../../services/variables';
import { AdHocVariableFilter, Field, GrafanaTheme2, Labels, LoadingState, SelectableValue } from '@grafana/data';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getValueFromAdHocVariableFilter,
  getValueFromFieldsFilter,
} from '../../../services/variableGetters';
import { FilterOp } from '../../../services/filterTypes';
import { LokiQuery } from '../../../services/lokiQuery';
import { css } from '@emotion/css';
import { rest } from 'lodash';
import { NumericFilterPopoverScene } from './NumericFilterPopoverScene';
import { getDetectedFieldType } from '../../../services/fields';
import { logger } from '../../../services/logger';
import { testIds } from '../../../services/testIds';

interface SelectLabelActionSceneState extends SceneObjectState {
  labelName: string;
  fieldType: ValueSlugs;
  hideValueDrilldown?: boolean;
  hasSparseFilters?: boolean;
  hasNumericFilters?: boolean;
  selectedValue?: SelectableValue<string>;
  popover?: NumericFilterPopoverScene;
  showPopover: boolean;
}

const INCLUDE_VALUE = 'Include';
const EXCLUDE_VALUE = 'Exclude';
const NUMERIC_FILTER_VALUE = 'Add to filter';

export class SelectLabelActionScene extends SceneObjectBase<SelectLabelActionSceneState> {
  constructor(state: Omit<SelectLabelActionSceneState, 'showPopover'>) {
    super({ ...state, showPopover: false });
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
    } else if (value.value === NUMERIC_FILTER_VALUE) {
      this.onClickNumericFilter(variableName);
    }

    this.setState({
      selectedValue: value,
    });
  }

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    const {
      hideValueDrilldown,
      labelName,
      hasSparseFilters,
      hasNumericFilters,
      selectedValue,
      popover,
      showPopover,
      fieldType,
    } = model.useState();
    const variable = model.getVariable();
    const variableName = variable.useState().name as VariableFilterType;
    const existingFilter = model.getExistingFilter(variable);
    const fieldValue = getValueFromAdHocVariableFilter(variable, existingFilter);
    const styles = useStyles2(getStyles);
    const popoverRef = useRef<HTMLButtonElement>(null);
    const filterButtonDisabled =
      fieldType === ValueSlugs.label &&
      variable.state.filters.filter((f) => f.key !== labelName && f.operator === FilterOp.Equal).length === 0;

    const isIncluded = existingFilter?.operator === FilterOp.NotEqual && fieldValue.value === EMPTY_VARIABLE_VALUE;
    const hasOtherFilter = !!existingFilter;

    const selectedOptionValue =
      selectedValue?.value ?? (isIncluded ? INCLUDE_VALUE : hasNumericFilters ? NUMERIC_FILTER_VALUE : INCLUDE_VALUE);

    const hasExistingNumericFilter = existingFilter?.operator
      ? [FilterOp.gte, FilterOp.gt, FilterOp.lte, FilterOp.lt].includes(existingFilter.operator as FilterOp)
      : false;
    const numericSelected = selectedOptionValue === NUMERIC_FILTER_VALUE || hasExistingNumericFilter;
    const includeSelected = selectedOptionValue === INCLUDE_VALUE && !numericSelected;

    const sparseIncludeOption: SelectableValue<string> = {
      value: INCLUDE_VALUE,
      component: () => (
        <SelectableValueComponent selected={includeSelected} text={`Include all log lines with ${labelName}`} />
      ),
    };
    const sparseExcludeOption: SelectableValue<string> = {
      value: EXCLUDE_VALUE,
      component: () => <SelectableValueComponent selected={false} text={`Exclude all log lines with ${labelName}`} />,
    };
    const numericFilterOption: SelectableValue<string> = {
      value: NUMERIC_FILTER_VALUE,
      component: () => (
        <SelectableValueComponent selected={numericSelected} text={`Add an expression, i.e. ${labelName} > 30`} />
      ),
    };

    const options: Array<SelectableValue<string>> = [];
    if (hasNumericFilters) {
      options.push(numericFilterOption);
    }

    if (hasSparseFilters) {
      if (!hasExistingNumericFilter) {
        options.push(sparseIncludeOption);
      }

      options.push(sparseExcludeOption);
    }

    const defaultOption = isIncluded
      ? sparseIncludeOption
      : hasNumericFilters
      ? numericFilterOption
      : sparseIncludeOption;

    return (
      <>
        {hasOtherFilter && (
          <IconButton
            disabled={filterButtonDisabled}
            name={'filter'}
            tooltip={`Clear ${labelName} filters`}
            onClick={() => model.clearFilters(variableName)}
          />
        )}
        {(hasNumericFilters || hasSparseFilters) && (
          <>
            <ButtonGroup data-testid={testIds.breakdowns.common.filterButtonGroup}>
              <Button
                data-testid={testIds.breakdowns.common.filterButton}
                ref={popoverRef}
                onClick={() => model.onChange(selectedValue ?? defaultOption)}
                size={'sm'}
                fill={'outline'}
                variant={'secondary'}
              >
                {selectedValue?.value ?? defaultOption.value}
              </Button>
              <ButtonSelect
                data-testid={testIds.breakdowns.common.filterSelect}
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

        {popover && (
          <PopoverController content={<popover.Component model={popover} />}>
            {(showPopper, hidePopper, popperProps) => {
              const blurFocusProps = {
                onBlur: hidePopper,
                onFocus: showPopper,
              };

              return (
                <>
                  {popoverRef.current && (
                    <>
                      {/* @ts-expect-error @todo upgrade typescript */}
                      <Popover
                        {...popperProps}
                        {...rest}
                        show={showPopover}
                        wrapperClassName={styles.popover}
                        referenceElement={popoverRef.current}
                        renderArrow={true}
                        {...blurFocusProps}
                      />
                    </>
                  )}
                </>
              );
            }}
          </PopoverController>
        )}
      </>
    );
  };

  private getExistingFilter(variable?: AdHocFiltersVariable): AdHocVariableFilter | undefined {
    let { labelName } = getPrimaryLabelFromUrl();
    if (this.state.labelName !== labelName) {
      return variable?.state.filters.find((filter) => {
        return filter.key === this.state.labelName;
      });
    }

    return undefined;
  }

  public onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);

    if (serviceScene.state.$data?.state.data?.state === LoadingState.Done) {
      this.calculateSparsity();
    }

    this._subs.add(
      sceneGraph.getData(this).subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
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

  public onClickNumericFilter = (variableType: VariableFilterType) => {
    const detectedFieldFrame = getDetectedFieldsFrame(this);
    const fieldType = getDetectedFieldType(this.state.labelName, detectedFieldFrame);

    if (!fieldType || fieldType === 'string' || fieldType === 'boolean' || fieldType === 'int') {
      const error = new Error(`Incorrect field type: ${fieldType}`);
      logger.error(error, { msg: `onClickNumericFilter invalid field type ${fieldType}` });
      throw error;
    }

    this.setState({
      popover: new NumericFilterPopoverScene({ labelName: this.state.labelName, variableType, fieldType }),
    });
    this.togglePopover();
  };

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

  public clearFilters = (variableType: VariableFilterType) => {
    clearFilters(this.state.labelName, this, variableType);
  };

  public togglePopover() {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  }

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
          hasNumericFilters: true,
        });
      }
    }

    if (!labels || !logsPanelData) {
      this.setState({
        hasSparseFilters: false,
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

    // Only show for sparse fields and existing include and exclude filters, which will match an empty string in the value
    const existingFilter = this.getExistingFilter(variable);
    const existingFilterValue =
      existingFilter && variable.state.name === VAR_FIELDS ? getValueFromFieldsFilter(existingFilter) : undefined;

    if (logLinesWithLabelCount < logsPanelData.length || existingFilterValue?.value === EMPTY_VARIABLE_VALUE) {
      this.setState({
        hasSparseFilters: true,
      });
    } else {
      this.setState({
        hasSparseFilters: false,
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

function SelectableValueComponent(props: { text: string; selected: boolean }) {
  const styles = useStyles2(getSelectableValueComponentStyles);
  return (
    <span className={styles.description}>
      {props.selected && <span className={styles.selected}></span>}
      {props.text}
    </span>
  );
}

const getSelectableValueComponentStyles = (theme: GrafanaTheme2) => {
  return {
    selected: css({
      label: 'selectable-value-selected',
      '&:before': {
        content: '""',
        position: 'absolute',
        left: 0,
        top: '4px',
        height: 'calc(100% - 8px)',
        width: '2px',
        backgroundColor: theme.colors.warning.main,
      },
    }),
    description: css({
      textAlign: 'left',
      fontSize: theme.typography.pxToRem(12),
    }),
  };
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    popover: css({
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
    }),
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
