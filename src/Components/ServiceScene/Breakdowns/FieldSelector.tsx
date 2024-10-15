import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2, InlineField, Icon, ActionMeta, InputActionMeta } from '@grafana/ui';
import { testIds } from '../../../services/testIds';
import { VariableValueOption } from '@grafana/scenes';

type Props<T> = {
  options: VariableValueOption[];
  value?: T;
  onChange: (label: T | undefined) => void;
  label: string;
};

export type AsyncFieldSelectorProps = {
  selectOption: (value: string) => void;
  isLoading: boolean;
  initialFilter: SelectableValue<string>;
} & Props<string>;

export function FieldSelector<T>({ options, value, onChange, label }: Props<T>) {
  const styles = useStyles2(getStyles);
  const [selected, setSelected] = useState(false);

  const selectableOptions: SelectableValue[] = options.map((option) => {
    return {
      label: option.label,
      value: option.value,
    };
  });
  return (
    <InlineField label={label}>
      <Select
        {...{ options: selectableOptions, value }}
        onOpenMenu={() => setSelected(true)}
        onCloseMenu={() => setSelected(false)}
        onChange={(selected: SelectableValue<T>) => onChange(selected.value)}
        className={styles.select}
        prefix={selected ? undefined : <Icon name={'search'} />}
      />
    </InlineField>
  );
}

export function ServiceFieldSelector({
  options,
  value,
  onChange,
  label,
  selectOption,
  isLoading,
  initialFilter,
}: AsyncFieldSelectorProps) {
  const styles = useStyles2(getStyles);
  const [selected, setSelected] = useState(false);
  const [customOption, setCustomOption] = useState<SelectableValue<string>>(initialFilter);

  const selectableOptions: SelectableValue[] = options.map((option) => {
    return {
      label: option.label,
      value: option.value,
    };
  });
  const allOptions =
    customOption && value && customOption.value?.includes(value)
      ? [customOption, ...selectableOptions]
      : selectableOptions;
  const selectedOption = allOptions?.find((opt) => opt.value === value);

  return (
    <InlineField className={styles.selectWrapper} grow={true} label={label}>
      <Select
        isLoading={isLoading}
        data-testid={testIds.exploreServiceSearch.search}
        placeholder={`Search values`}
        options={allOptions}
        isClearable={true}
        value={value}
        onOpenMenu={() => setSelected(true)}
        onCloseMenu={() => setSelected(false)}
        allowCustomValue={true}
        prefix={selected || selectedOption?.__isNew__ ? undefined : <Icon name={'search'} />}
        onChange={(value: SelectableValue<string>, actionMeta: ActionMeta) => {
          // Custom added value
          if (value?.__isNew__ || value?.icon) {
            setCustomOption({ ...value, icon: 'filter' });
            return onChange(value.value);
          }

          // If the user clears the search
          if (actionMeta.action === 'clear') {
            return onChange('');
          }

          // Select the service is the value is not a custom filter
          if (actionMeta.action === 'select-option' && value.value && !value.__isNew__) {
            selectOption(value.value);
          }
        }}
        onInputChange={(value: string | undefined, actionMeta: InputActionMeta) => {
          // Grafana/grafana doesn't have types from react-select, but we need the prevInput to add custom value when user clicks off with active search string
          const meta = actionMeta as InputActionMeta & { prevInputValue: string };

          // The user is typing
          if (meta.action === 'input-change') {
            return onChange(value);
          }

          // the user closed the menu, with text in search box
          if (meta.action === 'menu-close' && meta.prevInputValue) {
            setCustomOption({
              value: meta.prevInputValue,
              label: meta.prevInputValue,
              icon: 'filter',
              __isNew__: true,
            });
            return onChange(meta.prevInputValue);
          }
        }}
      />
    </InlineField>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(64),
      minWidth: theme.spacing(20),
    }),
    selectWrapper: css({
      maxWidth: theme.spacing(62.5),
      minWidth: theme.spacing(20),
      marginRight: theme.spacing.x1,
    }),
  };
}
