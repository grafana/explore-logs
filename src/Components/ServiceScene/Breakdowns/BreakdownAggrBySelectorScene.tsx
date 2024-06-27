import { SelectableValue } from '@grafana/data';
import { MultiSelect } from '@grafana/ui';
import React from 'react';

type BreakdownAggrBySelectorProps = {
  by: string[] | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (items: string[]) => void;
};

export const BreakdownAggrBySelector = (props: BreakdownAggrBySelectorProps) => {
  const { by, options, onChange } = props;

  return (
    <MultiSelect
      options={options}
      value={by}
      onChange={(items: SelectableValue<string[]>) => {
        if (!items) {
          onChange([]);
          return;
        }
        onChange((items as Array<{ value: string; label: string }>).map((item) => item.value));
      }}
    />
  );
};
