import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import {
  Button,
  ClickOutsideWrapper,
  Field,
  FieldSet,
  Input,
  Label,
  Modal,
  Stack,
  Switch,
  useStyles2,
} from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { getAdHocFiltersVariable } from '../../../services/variableGetters';
import { AdHocFilterWithLabels } from '../../../services/scenes';
import { validateVariableNameForField, VariableFilterType } from './AddToFiltersButton';
import { FilterOp } from '../../../services/filterTypes';
import ButtonRow = Modal.ButtonRow;

export interface NumericFilterPopoverSceneState extends SceneObjectState {
  labelName: string;
  variableType: VariableFilterType;
  gt?: number;
  gte?: boolean;
  lt?: number;
  lte?: boolean;
}

export class NumericFilterPopoverScene extends SceneObjectBase<NumericFilterPopoverSceneState> {
  constructor(state: NumericFilterPopoverSceneState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {}

  onSubmit() {
    // numeric values can only be fields or metadata variable
    const variable = getAdHocFiltersVariable(
      validateVariableNameForField(this.state.labelName, this.state.variableType),
      this
    );

    const filtersToAdd: AdHocFilterWithLabels[] = [];
    if (this.state.gt) {
      filtersToAdd.push({
        value: this.state.gt.toString(),
        key: this.state.labelName,
        operator: this.state.gte ? FilterOp.gte : FilterOp.gt,
      });
    }

    if (this.state.lt) {
      filtersToAdd.push({
        value: this.state.lt.toString(),
        key: this.state.labelName,
        operator: this.state.lte ? FilterOp.lte : FilterOp.lt,
      });
    }

    variable.setState({
      filters: [...variable.state.filters, ...filtersToAdd],
    });

    const selectLabelActionScene = sceneGraph.getAncestor(this, SelectLabelActionScene);
    selectLabelActionScene.togglePopover();
  }

  public static Component = ({ model }: SceneComponentProps<NumericFilterPopoverScene>) => {
    const popoverStyles = useStyles2(getPopoverStyles);
    const { labelName, gt, lt, gte, lte } = model.useState();

    const selectLabelActionScene = sceneGraph.getAncestor(model, SelectLabelActionScene);

    return (
      <ClickOutsideWrapper onClick={() => selectLabelActionScene.togglePopover()}>
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
                        console.log('ugh', e);
                        console.log('e.currentTarget.value', e.currentTarget.value);
                        model.setState({
                          gt: e.currentTarget.value !== '' ? Number(e.currentTarget.value) : undefined,
                        });
                      }}
                      value={gt}
                      type={'number'}
                    />
                  </Field>
                </Label>
                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.switchFieldLabel}>Inclusive</span>}
                  >
                    <Switch onChange={(e) => model.setState({ gte: !gte })} value={gte} />
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
                      value={lt}
                      type={'number'}
                    />
                  </Field>
                </Label>
                <Label>
                  <Field
                    horizontal={true}
                    className={popoverStyles.card.field}
                    label={<span className={popoverStyles.card.switchFieldLabel}>Inclusive</span>}
                  >
                    <Switch onChange={(e) => model.setState({ lte: !lte })} value={lte} />
                  </Field>
                </Label>
              </FieldSet>
            </div>

            {/* buttons */}
            <ButtonRow>
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
            </ButtonRow>
          </div>
        </Stack>
      </ClickOutsideWrapper>
    );
  };
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
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
