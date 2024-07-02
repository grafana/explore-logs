import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2, InlineField, Icon } from '@grafana/ui';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
  label: string;
};

export function FieldSelector({ options, value, onChange, label }: Props) {
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
