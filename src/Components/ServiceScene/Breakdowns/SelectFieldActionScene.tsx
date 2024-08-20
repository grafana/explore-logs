import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button, Input, Modal, Select, useStyles2 } from '@grafana/ui';
import React, { useRef } from 'react';
import { addNumericFilter, addToFilters } from './AddToFiltersButton';
import { FilterButton } from '../../FilterButton';
import { getFieldsVariable } from '../../../services/variables';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { FilterOp } from '../../../services/filters';

interface SelectFieldActionSceneState extends SceneObjectState {
  labelName: string;
  //@todo merge
  hideValueDrilldown?: boolean;
  numericFilter?: boolean;
  showPopover?: boolean;
  min?: number;
  max?: number;
}

export class SelectFieldActionScene extends SceneObjectBase<SelectFieldActionSceneState> {
  public static Component = ({ model }: SceneComponentProps<SelectFieldActionScene>) => {
    const { showPopover, numericFilter, hideValueDrilldown, labelName } = model.useState();
    const fields = getFieldsVariable(model);
    const existingFilter = fields.state.filters.find((filter) => {
      return filter.key === labelName;
    });
    const ref = useRef<HTMLButtonElement>(null);
    const styles = useStyles2(getStyles);

    return (
      <>
        {numericFilter && (
          <>
            <Button ref={ref} onClick={model.onClickFilter} variant={'secondary'} size={'sm'} icon={'filter'}>
              Filter
            </Button>
            {/*<Popover show={showPopover ?? false} content={<>Hello popover</>} referenceElement={ref.current}>Hello govna</Popover>*/}
            <Modal isOpen={showPopover} title={'Add filter'}>
              <div className={styles.row}>
                {labelName}
                <Select
                  className={styles.select}
                  onChange={() => {
                    console.log('not imp');
                  }}
                  options={[
                    { value: 'between', label: 'between' },
                    { value: 'gt', label: '>' },
                    { value: 'lt', label: '<' },
                  ]}
                  value={'between'}
                ></Select>
                <Input
                  onChange={(e) => {
                    model.setState({
                      min: parseFloat(e.currentTarget.value),
                    });
                  }}
                  className={styles.input}
                  type={'number'}
                />
                <span className={styles.span}>and</span>
                <Input
                  onChange={(e) => {
                    model.setState({
                      max: parseFloat(e.currentTarget.value),
                    });
                  }}
                  className={styles.input}
                  type={'number'}
                />
              </div>

              <Modal.ButtonRow>
                <Button onClick={model.onCloseModal} variant="secondary" fill="outline">
                  Cancel
                </Button>
                <Button onClick={model.onSubmitModal} fill="outline">
                  Add to filters
                </Button>
              </Modal.ButtonRow>
            </Modal>
          </>
        )}
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

        {hideValueDrilldown !== true && (
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

  public onClickFilter = () => {
    this.setState({
      showPopover: true,
    });
  };

  public onClickViewValues = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.field, this.state.labelName, serviceScene);
  };

  public onClickExcludeEmpty = () => {
    addToFilters(this.state.labelName, '""', 'exclude', this);
  };

  public onSubmitModal = () => {
    if (this.state.min !== undefined) {
      addNumericFilter(this.state.labelName, this.state.min.toString(), FilterOp.GreaterThan, this);
    }
    if (this.state.max !== undefined) {
      addNumericFilter(this.state.labelName, this.state.max.toString(), FilterOp.LessThan, this);
    }
    this.setState({
      showPopover: false,
    });
  };

  public onCloseModal = () => {
    this.setState({
      showPopover: false,
    });
  };

  public onClickIncludeEmpty = () => {
    // If json do we want != '{}'?
    addToFilters(this.state.labelName, '""', 'include', this);
  };

  public clearFilter = () => {
    addToFilters(this.state.labelName, '""', 'clear', this);
  };
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    select: css({
      maxWidth: '150px',
      marginLeft: 10,
      marginRight: 10,
    }),
    input: css({
      maxWidth: '100px',
      marginLeft: 10,
      marginRight: 10,
    }),
    span: css({
      marginLeft: 10,
      marginRight: 10,
    }),
    row: css({
      display: 'flex',
      margin: '0 auto',
      justifyContent: 'center',
      alignItems: 'center',
    }),
  };
};
