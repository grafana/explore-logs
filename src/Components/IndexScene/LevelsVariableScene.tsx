import {
  ControlsLabel,
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableValueChangedEvent,
} from '@grafana/scenes';
import React from 'react';
import { getLevelsVariable } from '../../services/variableGetters';
import { GrafanaTheme2, MetricFindValue, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { Icon, MultiSelect, useStyles2 } from '@grafana/ui';
import { LEVEL_VARIABLE_VALUE } from '../../services/variables';
import { FilterOp } from '../../services/filterTypes';
import { testIds } from '../../services/testIds';

type ChipOption = MetricFindValue & { selected?: boolean };
export interface LevelsVariableSceneState extends SceneObjectState {
  options?: ChipOption[];
  isLoading: boolean;
  visible: boolean;
  isOpen: boolean;
}
export const LEVELS_VARIABLE_SCENE_KEY = 'levels-var-custom-renderer';
export class LevelsVariableScene extends SceneObjectBase<LevelsVariableSceneState> {
  constructor(state: Partial<LevelsVariableSceneState>) {
    super({ ...state, isLoading: false, visible: false, key: LEVELS_VARIABLE_SCENE_KEY, isOpen: false });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.onFilterChange();
    const levelsVar = getLevelsVariable(this);
    levelsVar.subscribeToEvent(SceneVariableValueChangedEvent, () => this.onFilterChange());
  }

  private onFilterChange() {
    const levelsVar = getLevelsVariable(this);
    if (levelsVar.state.filters.length) {
      this.setState({
        options: levelsVar.state.filters.map((filter) => ({
          text: filter.valueLabels?.[0] ?? filter.value,
          selected: true,
          value: filter.value,
        })),
      });
    }
  }

  getTagValues = () => {
    this.setState({ isLoading: true });
    const levelsVar = getLevelsVariable(this);
    const levelsKeys = levelsVar?.state?.getTagValuesProvider?.(
      levelsVar,
      levelsVar.state.filters[0] ?? { key: LEVEL_VARIABLE_VALUE }
    );
    levelsKeys?.then((response) => {
      if (Array.isArray(response.values)) {
        this.setState({
          isLoading: false,
          options: response.values.map((value) => {
            return {
              text: value.text,
              value: value.value ?? value.text,
              selected: levelsVar.state.filters.some((filter) => filter.value === value.text),
            };
          }),
        });
      }
    });
  };

  updateFilters = (skipPublish: boolean, forcePublish?: boolean) => {
    const levelsVar = getLevelsVariable(this);
    const filterOptions = this.state.options?.filter((opt) => opt.selected);

    levelsVar.updateFilters(
      filterOptions?.map((filterOpt) => ({
        key: LEVEL_VARIABLE_VALUE,
        operator: FilterOp.Equal,
        value: filterOpt.text,
      })) ?? [],
      { skipPublish, forcePublish }
    );
  };

  onChangeOptions = (options: SelectableValue[]) => {
    this.setState({
      options: this.state.options?.map((value) => {
        if (options.some((opt) => opt.value === value.value)) {
          return { ...value, selected: true };
        }
        return { ...value, selected: false };
      }),
    });

    if (!this.state.isOpen) {
      this.updateFilters(false);
    } else {
      this.updateFilters(true);
    }
  };

  openSelect = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  onCloseMenu = () => {
    this.openSelect(false);
    // Update filters and run queries on close
    this.updateFilters(false, true);
  };

  static Component = ({ model }: SceneComponentProps<LevelsVariableScene>) => {
    const { options, isLoading, visible, isOpen } = model.useState();
    const styles = useStyles2(getStyles);

    if (!visible) {
      return null;
    }

    return (
      <div data-testid={testIds.variables.levels.inputWrap}>
        <ControlsLabel layout="vertical" label={'Log levels'} />
        <MultiSelect
          aria-label={'Log level filters'}
          prefix={<Icon size={'lg'} name={'filter'} />}
          placeholder={'All levels'}
          className={styles.flex}
          onChange={model.onChangeOptions}
          onCloseMenu={() => model.onCloseMenu()}
          onOpenMenu={model.getTagValues}
          onFocus={() => model.openSelect(true)}
          menuShouldPortal={true}
          isOpen={isOpen}
          isLoading={isLoading}
          isClearable={true}
          blurInputOnSelect={false}
          closeMenuOnSelect={false}
          openMenuOnFocus={true}
          showAllSelectedWhenOpen={true}
          hideSelectedOptions={false}
          value={options?.filter((v) => v.selected)}
          options={options?.map((val) => ({
            value: val.text,
            label: val.text,
          }))}
        />
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  flex: css({
    flex: '1',
  }),
  removeButton: css({
    marginInline: theme.spacing(0.5),
    cursor: 'pointer',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  pillText: css({
    maxWidth: '200px',
    width: '100%',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  tooltipText: css({
    textAlign: 'center',
  }),
  comboboxWrapper: css({
    display: 'flex',
    flexWrap: 'nowrap',
    alignItems: 'center',
    columnGap: theme.spacing(1),
    rowGap: theme.spacing(0.5),
    minHeight: theme.spacing(4),
    backgroundColor: theme.components.input.background,
    border: `1px solid ${theme.colors.border.strong}`,
    borderRadius: theme.shape.radius.default,
    paddingInline: theme.spacing(1),
    paddingBlock: theme.spacing(0.5),
    flexGrow: 1,
  }),
  comboboxFocusOutline: css({
    '&:focus-within': {
      outline: '2px dotted transparent',
      outlineOffset: '2px',
      boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
      transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
      transitionDuration: '0.2s',
      transitionProperty: 'outline, outline-offset, box-shadow',
      zIndex: 2,
    },
  }),
  filterIcon: css({
    color: theme.colors.text.secondary,
    alignSelf: 'center',
  }),
});
