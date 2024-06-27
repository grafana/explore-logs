import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2, InlineField } from '@grafana/ui';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
  label: string;
};

export function FieldSelector({ options, value, onChange, label }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <InlineField className={styles.field} label={label}>
      <Select {...{ options, value }} onChange={(selected) => onChange(selected.value)} className={styles.select} />
    </InlineField>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(64),
    }),
    field: css({
      label: 'field',
      marginBottom: 0,
    }),
  };
}
