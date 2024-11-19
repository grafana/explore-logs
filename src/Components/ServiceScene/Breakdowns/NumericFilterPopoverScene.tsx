import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import {
  Button,
  ClickOutsideWrapper,
  Field,
  FieldSet,
  Input,
  Label,
  Modal,
  Select,
  Stack,
  Switch,
  useStyles2,
} from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { addNumericFilter, validateVariableNameForField, VariableFilterType } from './AddToFiltersButton';
import { FilterOp } from '../../../services/filterTypes';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from '../../../services/variableGetters';
import { logger } from '../../../services/logger';

export interface NumericFilterPopoverSceneState extends SceneObjectState {
  labelName: string;
  variableType: VariableFilterType;
  gt?: number;
  gte?: boolean;
  lt?: number;
  lte?: boolean;
  fieldType: 'float' | 'duration' | 'bytes';
}

export type NumericFilterPopoverSceneStateTotal =
  | (NumericFilterPopoverSceneState & FloatTypes)
  | (NumericFilterPopoverSceneState & DurationTypes)
  | (NumericFilterPopoverSceneState & ByteTypes);

enum durationUnitValues {
  ns = 'ns',
  us = 'µs',
  ms = 'ms',
  s = 's',
  m = 'm',
  h = 'h',
}

enum byteUnitValues {
  KiB = 'KiB',
  MiB = 'MiB',
  GiB = 'GiB',
  TiB = 'TiB',
  kB = 'kB',
  MB = 'MB',
  GB = 'GB',
  TB = 'TB',
  KB = 'KB',
  B = 'B',
}

interface FloatUnitTypes {
  ltu: '';
  gtu: '';
}

interface FloatTypes extends FloatUnitTypes {
  fieldType: 'float';
}

interface DurationUnitTypes {
  ltu: durationUnitValues;
  gtu: durationUnitValues;
}

interface DurationTypes extends DurationUnitTypes {
  fieldType: 'duration';
}

interface ByteUnitTypes {
  ltu: byteUnitValues;
  gtu: byteUnitValues;
}

interface ByteTypes extends ByteUnitTypes {
  fieldType: 'bytes';
}

export class NumericFilterPopoverScene extends SceneObjectBase<NumericFilterPopoverSceneStateTotal> {
  constructor(state: Omit<NumericFilterPopoverSceneStateTotal, 'gtu' | 'ltu'>) {
    let units: FloatUnitTypes | DurationUnitTypes | ByteUnitTypes;
    const fieldType: 'float' | 'bytes' | 'duration' = state.fieldType;
    if (fieldType === 'bytes') {
      units = { ltu: byteUnitValues.B, gtu: byteUnitValues.B };
    } else if (fieldType === 'duration') {
      units = { ltu: durationUnitValues.s, gtu: durationUnitValues.s };
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
        console.log('gtFilter extractedValue', extractedValue);

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

    this.setState(stateUpdate);
  }

  onSubmit() {
    // @todo "0" values break byte queries see https://github.com/grafana/loki/issues/14993
    // numeric values can only be fields or metadata variable
    if (this.state.gt !== undefined) {
      addNumericFilter(
        this.state.labelName,
        this.state.gt.toString() + this.state.gtu,
        this.state.gte ? FilterOp.gte : FilterOp.gt,
        this,
        this.state.variableType
      );
    }

    if (this.state.lt !== undefined) {
      addNumericFilter(
        this.state.labelName,
        this.state.lt.toString() + this.state.ltu,
        this.state.lte ? FilterOp.lte : FilterOp.lt,
        this,
        this.state.variableType
      );
    }

    const selectLabelActionScene = sceneGraph.getAncestor(this, SelectLabelActionScene);
    selectLabelActionScene.togglePopover();
  }

  public static Component = ({ model }: SceneComponentProps<NumericFilterPopoverScene>) => {
    const popoverStyles = useStyles2(getPopoverStyles);
    const { labelName, gt, lt, gte, lte, gtu, ltu, fieldType } = model.useState();

    const selectLabelActionScene = sceneGraph.getAncestor(model, SelectLabelActionScene);

    return (
      <ClickOutsideWrapper useCapture={true} onClick={() => selectLabelActionScene.togglePopover()}>
        <Stack direction="column" gap={0} role="tooltip">
          <div className={popoverStyles.card.body}>
            <div className={popoverStyles.card.title}>{labelName}</div>

            <div className={popoverStyles.card.fieldWrap}>
              {/* greater than */}
              <FieldSet className={popoverStyles.card.fieldset}>
                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.numberFieldLabel}>Greater than</span>}
                  >
                    <Input
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
                </Label>
                {fieldType !== 'float' && (
                  <Label>
                    <Field
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

                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.switchFieldLabel}>Inclusive</span>}
                  >
                    <Switch onChange={() => model.setState({ gte: !gte })} value={gte} />
                  </Field>
                </Label>
              </FieldSet>

              {/* less than */}
              <FieldSet className={popoverStyles.card.fieldset}>
                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.numberFieldLabel}>Less than</span>}
                  >
                    <Input
                      onChange={(e) =>
                        model.setState({ lt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined })
                      }
                      className={popoverStyles.card.numberInput}
                      value={lt}
                      type={'number'}
                    />
                  </Field>
                </Label>
                {fieldType !== 'float' && (
                  <Label>
                    <Field
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
                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.switchFieldLabel}>Inclusive</span>}
                  >
                    <Switch onChange={() => model.setState({ lte: !lte })} value={lte} />
                  </Field>
                </Label>
              </FieldSet>
            </div>

            {/* buttons */}
            <Modal.ButtonRow>
              <Button
                disabled={gt === undefined && lt === undefined}
                onClick={() => model.onSubmit()}
                size={'sm'}
                variant={'primary'}
                fill={'outline'}
              >
                Add
              </Button>

              <Button
                onClick={() => selectLabelActionScene.togglePopover()}
                size={'sm'}
                variant={'secondary'}
                fill={'outline'}
              >
                Cancel
              </Button>
            </Modal.ButtonRow>
          </div>
        </Stack>
      </ClickOutsideWrapper>
    );
  };
}

export function extractValueFromString(
  inputString: string,
  inputType: 'bytes' | 'duration'
): { value: number; unit: byteUnitValues | durationUnitValues } | undefined {
  if (inputType === 'duration') {
    const durationValues = Object.values(durationUnitValues);

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
    const bytesValues = Object.values(byteUnitValues);

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

function getUnitOptions(fieldType: 'duration' | 'bytes'): Array<SelectableValue<durationUnitValues | byteUnitValues>> {
  if (fieldType === 'duration') {
    const keys = Object.keys(durationUnitValues) as Array<keyof typeof durationUnitValues>;
    return keys.map((key) => {
      return {
        text: key,
        value: durationUnitValues[key],
        label: key,
      };
    });
  }

  if (fieldType === 'bytes') {
    const keys = Object.keys(byteUnitValues) as Array<keyof typeof byteUnitValues>;
    return keys.map((key) => {
      return {
        text: key,
        value: byteUnitValues[key],
        label: key,
      };
    });
  }

  const error = new Error(`invalid field type: ${fieldType}`);
  logger.error(error);
  throw error;
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    selectInput: css({}),
    numberInput: css({
      width: '75px',
    }),
    fieldWrap: css({
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      paddingBottom: 0,
    }),
    field: css({
      display: 'flex',
      alignItems: 'center',
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
