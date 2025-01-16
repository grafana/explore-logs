import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, ClickOutsideWrapper, Field, FieldSet, Input, Label, Select, Stack, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { addNumericFilter, removeFilter, validateVariableNameForField, VariableFilterType } from './AddToFiltersButton';
import { FilterOp } from '../../../services/filterTypes';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from '../../../services/variableGetters';
import { logger } from '../../../services/logger';
import { testIds } from '../../../services/testIds';

export interface NumericFilterPopoverSceneState extends SceneObjectState {
  labelName: string;
  variableType: VariableFilterType;
  gt?: number;
  gte?: boolean;
  lt?: number;
  lte?: boolean;
  fieldType: 'float' | 'duration' | 'bytes';
  hasExistingFilter?: boolean;
}

export type NumericFilterPopoverSceneStateTotal =
  | (NumericFilterPopoverSceneState & FloatTypes)
  | (NumericFilterPopoverSceneState & DurationTypes)
  | (NumericFilterPopoverSceneState & ByteTypes);

enum DisplayDurationUnits {
  ns = 'ns',
  us = 'µs',
  ms = 'ms',
  s = 's',
  m = 'm',
  h = 'h',
}

enum DisplayByteUnits {
  B = 'B',
  KB = 'KB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
}

interface FloatUnitTypes {
  ltu: '';
  gtu: '';
}

interface FloatTypes extends FloatUnitTypes {
  fieldType: 'float';
}

interface DurationUnitTypes {
  ltu: DisplayDurationUnits;
  gtu: DisplayDurationUnits;
}

interface DurationTypes extends DurationUnitTypes {
  fieldType: 'duration';
}

interface ByteUnitTypes {
  ltu: DisplayByteUnits;
  gtu: DisplayByteUnits;
}

interface ByteTypes extends ByteUnitTypes {
  fieldType: 'bytes';
}

export class NumericFilterPopoverScene extends SceneObjectBase<NumericFilterPopoverSceneStateTotal> {
  constructor(state: Omit<NumericFilterPopoverSceneStateTotal, 'gtu' | 'ltu'>) {
    let units: FloatUnitTypes | DurationUnitTypes | ByteUnitTypes;
    const fieldType: 'float' | 'bytes' | 'duration' = state.fieldType;
    if (fieldType === 'bytes') {
      units = { ltu: DisplayByteUnits.B, gtu: DisplayByteUnits.B };
    } else if (fieldType === 'duration') {
      units = { ltu: DisplayDurationUnits.s, gtu: DisplayDurationUnits.s };
    } else if (fieldType === 'float') {
      units = { ltu: '', gtu: '' };
    } else {
      throw new Error(`field type incorrectly defined: ${fieldType}`);
    }

    // @todo - how to avoid type assertion?
    super({ ...state, ...units } as NumericFilterPopoverSceneStateTotal);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    // get existing values if they exist
    const variable = getAdHocFiltersVariable(
      validateVariableNameForField(this.state.labelName, this.state.variableType),
      this
    );
    const filters = variable.state.filters.filter((f) => f.key === this.state.labelName);
    const gtFilter = filters.find((f) => f.operator === FilterOp.gte || f.operator === FilterOp.gt);
    const ltFilter = filters.find((f) => f.operator === FilterOp.lte || f.operator === FilterOp.lt);
    let stateUpdate: Partial<NumericFilterPopoverSceneStateTotal> = {};

    if (this.state.fieldType === 'duration' || this.state.fieldType === 'bytes') {
      if (gtFilter) {
        const extractedValue = extractValueFromString(getValueFromFieldsFilter(gtFilter).value, this.state.fieldType);

        if (extractedValue) {
          stateUpdate.gt = extractedValue.value;
          stateUpdate.gtu = extractedValue.unit;
          stateUpdate.gte = gtFilter.operator === FilterOp.gte;
        }
      }

      if (ltFilter) {
        const extractedValue = extractValueFromString(getValueFromFieldsFilter(ltFilter).value, this.state.fieldType);

        if (extractedValue) {
          stateUpdate.lt = extractedValue.value;
          stateUpdate.ltu = extractedValue.unit;
          stateUpdate.lte = ltFilter.operator === FilterOp.lte;
        }
      }
    } else {
      // Floats have no unit
      if (gtFilter) {
        const extractedValue = getValueFromFieldsFilter(gtFilter).value;
        stateUpdate.gt = Number(extractedValue);
        stateUpdate.gtu = '';
        stateUpdate.gte = gtFilter.operator === FilterOp.gte;
      }
      if (ltFilter) {
        const extractedValue = getValueFromFieldsFilter(ltFilter).value;
        stateUpdate.lt = Number(extractedValue);
        stateUpdate.ltu = '';
        stateUpdate.lte = ltFilter.operator === FilterOp.lte;
      }
    }

    if (Object.keys(stateUpdate).length !== 0) {
      stateUpdate.hasExistingFilter = true;
    }

    this.setState(stateUpdate);
  }

  onSubmit() {
    // "0" values break byte queries see https://github.com/grafana/loki/issues/14993, for now we remove the filter when a 0 value is entered to prevent breakage
    // numeric values can only be fields or metadata variable
    if (this.state.gt) {
      addNumericFilter(
        this.state.labelName,
        this.state.gt.toString() + this.state.gtu,
        this.state.gte ? FilterOp.gte : FilterOp.gt,
        this,
        this.state.variableType
      );
    } else {
      removeFilter(this.state.labelName, this, this.state.gte ? FilterOp.gte : FilterOp.gt, this.state.variableType);
    }

    if (this.state.lt) {
      addNumericFilter(
        this.state.labelName,
        this.state.lt.toString() + this.state.ltu,
        this.state.lte ? FilterOp.lte : FilterOp.lt,
        this,
        this.state.variableType
      );
    } else {
      removeFilter(this.state.labelName, this, this.state.lte ? FilterOp.lte : FilterOp.lt, this.state.variableType);
    }

    const selectLabelActionScene = sceneGraph.getAncestor(this, SelectLabelActionScene);
    selectLabelActionScene.togglePopover();
  }
  onInputKeydown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const formDisabled = this.state.gt === undefined && this.state.lt === undefined;
    if (e.key === 'Enter' && !formDisabled) {
      this.onSubmit();
    }
  };

  public static Component = ({ model }: SceneComponentProps<NumericFilterPopoverScene>) => {
    const popoverStyles = useStyles2(getPopoverStyles);
    const { labelName, gt, lt, gte, lte, gtu, ltu, fieldType, hasExistingFilter } = model.useState();
    const subTitle = fieldType !== 'float' && fieldType !== labelName ? `(${fieldType})` : undefined;

    const selectLabelActionScene = sceneGraph.getAncestor(model, SelectLabelActionScene);
    const formDisabled = gt === undefined && lt === undefined;

    return (
      <ClickOutsideWrapper useCapture={true} onClick={() => selectLabelActionScene.togglePopover()}>
        <Stack direction="column" gap={0} role="tooltip">
          <div className={popoverStyles.card.body}>
            <div className={popoverStyles.card.title}>
              {labelName} {subTitle}
            </div>

            <div className={popoverStyles.card.fieldWrap}>
              {/* greater than */}
              <FieldSet className={popoverStyles.card.fieldset}>
                <Field
                  data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThanInclusive}
                  horizontal={true}
                  className={cx(popoverStyles.card.field, popoverStyles.card.inclusiveField)}
                >
                  <Select<string>
                    className={popoverStyles.card.inclusiveInput}
                    menuShouldPortal={false}
                    value={gte !== undefined ? gte.toString() : 'false'}
                    options={[
                      { label: 'Greater than', value: 'false' },
                      { label: 'Greater than or equal', value: 'true' },
                    ]}
                    onChange={(value) => model.setState({ gte: value.value === 'true' })}
                  />
                </Field>
                <Field
                  data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThan}
                  horizontal={true}
                  className={popoverStyles.card.field}
                >
                  <Input
                    onKeyDownCapture={model.onInputKeydown}
                    autoFocus={true}
                    onChange={(e) => {
                      model.setState({
                        gt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined,
                      });
                    }}
                    className={popoverStyles.card.numberInput}
                    value={gt}
                    type={'number'}
                  />
                </Field>
                {fieldType !== 'float' && (
                  <Label>
                    <Field
                      data-testid={testIds.breakdowns.common.filterNumericPopover.inputGreaterThanUnit}
                      horizontal={true}
                      className={popoverStyles.card.field}
                      label={<span className={popoverStyles.card.unitFieldLabel}>Unit</span>}
                    >
                      <Select
                        onChange={(e) => {
                          model.setState({
                            gtu: e.value,
                          });
                        }}
                        menuShouldPortal={false}
                        options={getUnitOptions(fieldType)}
                        className={popoverStyles.card.selectInput}
                        value={gtu}
                      />
                    </Field>
                  </Label>
                )}
              </FieldSet>

              {/* less than */}
              <FieldSet className={popoverStyles.card.fieldset}>
                <Field
                  data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThanInclusive}
                  horizontal={true}
                  className={cx(popoverStyles.card.field, popoverStyles.card.inclusiveField)}
                >
                  <Select<string>
                    className={popoverStyles.card.inclusiveInput}
                    menuShouldPortal={false}
                    value={lte !== undefined ? lte.toString() : 'false'}
                    options={[
                      { label: 'Less than', value: 'false' },
                      { label: 'Less than or equal', value: 'true' },
                    ]}
                    onChange={(value) => model.setState({ lte: value.value === 'true' })}
                  />
                </Field>
                <Field
                  data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThan}
                  horizontal={true}
                  className={popoverStyles.card.field}
                >
                  <Input
                    onKeyDownCapture={model.onInputKeydown}
                    onChange={(e) =>
                      model.setState({ lt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined })
                    }
                    className={popoverStyles.card.numberInput}
                    value={lt}
                    type={'number'}
                  />
                </Field>
                {fieldType !== 'float' && (
                  <Label>
                    <Field
                      data-testid={testIds.breakdowns.common.filterNumericPopover.inputLessThanUnit}
                      horizontal={true}
                      className={popoverStyles.card.field}
                      label={<span className={popoverStyles.card.unitFieldLabel}>Unit</span>}
                    >
                      <Select
                        onChange={(e) => {
                          model.setState({
                            ltu: e.value,
                          });
                        }}
                        menuShouldPortal={false}
                        options={getUnitOptions(fieldType)}
                        className={popoverStyles.card.selectInput}
                        value={ltu}
                      />
                    </Field>
                  </Label>
                )}
              </FieldSet>
            </div>

            {/* buttons */}
            <div className={popoverStyles.card.buttons}>
              {hasExistingFilter && (
                <Button
                  data-testid={testIds.breakdowns.common.filterNumericPopover.removeButton}
                  disabled={!hasExistingFilter}
                  onClick={() => {
                    model.setState({
                      gt: undefined,
                      lt: undefined,
                    });
                    model.onSubmit();
                  }}
                  size={'sm'}
                  variant={'destructive'}
                  fill={'outline'}
                >
                  Remove
                </Button>
              )}
              <Button
                data-testid={testIds.breakdowns.common.filterNumericPopover.submitButton}
                disabled={formDisabled}
                onClick={() => model.onSubmit()}
                size={'sm'}
                variant={'primary'}
                fill={'outline'}
                type={'submit'}
              >
                Add
              </Button>

              <Button
                data-testid={testIds.breakdowns.common.filterNumericPopover.cancelButton}
                onClick={() => selectLabelActionScene.togglePopover()}
                size={'sm'}
                variant={'secondary'}
                fill={'outline'}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Stack>
      </ClickOutsideWrapper>
    );
  };
}

export function extractValueFromString(
  inputString: string,
  inputType: 'bytes' | 'duration'
): { value: number; unit: DisplayByteUnits | DisplayDurationUnits } | undefined {
  if (inputType === 'duration') {
    const durationValues = Object.values(DisplayDurationUnits);

    // Check the end of the filter value for a unit that exactly matches
    const durationValue = durationValues.find((durationValue) => {
      const durationValueLength = durationValue.length;
      return inputString.slice(durationValueLength * -1) === durationValue;
    });

    if (durationValue) {
      const value = Number(inputString.replace(durationValue, ''));
      if (!isNaN(value)) {
        return {
          unit: durationValue,
          value: value,
        };
      }
    }
  }

  if (inputType === 'bytes') {
    const bytesValues = Object.values(DisplayByteUnits)
      // must be sorted from longest to shortest
      .sort((a, b) => b.length - a.length);

    // Check the end of the filter value for a unit that exactly matches
    const bytesValue = bytesValues.find((bytesValue) => {
      const byteValueLength = bytesValue.length;
      return inputString.slice(byteValueLength * -1) === bytesValue;
    });

    if (bytesValue) {
      const value = Number(inputString.replace(bytesValue, ''));
      if (!isNaN(value)) {
        return {
          unit: bytesValue,
          value: value,
        };
      }
    }
  }

  return undefined;
}

function getUnitOptions(
  fieldType: 'duration' | 'bytes'
): Array<SelectableValue<DisplayDurationUnits | DisplayByteUnits>> {
  if (fieldType === 'duration') {
    const keys = Object.keys(DisplayDurationUnits) as Array<keyof typeof DisplayDurationUnits>;
    return keys.map((key) => {
      return {
        text: key,
        value: DisplayDurationUnits[key],
        label: key,
      };
    });
  }

  if (fieldType === 'bytes') {
    const keys = Object.keys(DisplayByteUnits) as Array<keyof typeof DisplayByteUnits>;
    return keys.map((key) => {
      return {
        text: key,
        value: DisplayByteUnits[key],
        label: key,
      };
    });
  }

  const error = new Error(`invalid field type: ${fieldType}`);
  logger.error(error, { msg: 'getUnitOptions, invalid field type' });
  throw error;
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    buttons: css({
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: theme.spacing(1.5),
      marginTop: theme.spacing(1),
    }),
    inclusiveInput: css({
      minWidth: '185px',
    }),
    selectInput: css({
      minWidth: '65px',
    }),
    numberInput: css({
      width: '75px',
    }),
    fieldWrap: css({
      display: 'flex',
      flexDirection: 'column',
      paddingTop: theme.spacing(2),
      paddingBottom: 0,
    }),
    field: css({
      display: 'flex',
      alignItems: 'center',
      marginBottom: theme.spacing(1),
    }),
    inclusiveField: css({
      marginRight: theme.spacing(1),
    }),
    unitFieldLabel: css({
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(1.5),
    }),
    numberFieldLabel: css({
      width: '100px',
    }),
    switchFieldLabel: css({
      marginLeft: theme.spacing(2),
      marginRight: theme.spacing(1),
    }),
    fieldset: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      marginBottom: 0,
    }),
    title: css({}),
    body: css({
      padding: theme.spacing(2),
    }),
    p: css({
      maxWidth: 300,
    }),
  },
});
