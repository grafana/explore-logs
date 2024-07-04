import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, InlineField, Select, useStyles2 } from '@grafana/ui';

type Props<T> = {
  options: Array<SelectableValue<T>>;
  value?: T;
  onChange: (label: T | undefined) => void;
  label: string;
};

export function FieldSelector<T>({ options, value, onChange, label }: Props<T>) {
  const styles = useStyles2(getStyles);
  const [selected, setSelected] = useState(false);
  return (
    <InlineField label={label}>
      <Select
        {...{ options, value }}
        onOpenMenu={() => setSelected(true)}
        onCloseMenu={() => setSelected(false)}
        onChange={(selected) => onChange(selected.value)}
        className={styles.select}
        prefix={selected ? undefined : <Icon name={'search'} />}
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
  };
}
