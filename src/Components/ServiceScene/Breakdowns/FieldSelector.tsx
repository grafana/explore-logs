import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Select, useStyles2, InlineField, Stack, IconButton } from '@grafana/ui';
import { ALL_VARIABLE_VALUE } from 'services/variables';

type Props = {
  options: Array<SelectableValue<string>>;
  value?: string;
  onChange: (label: string | undefined) => void;
  label: string;
};

export function FieldSelector({ options, value, onChange, label }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div>
      <Stack>
        <InlineField label={label}>
          <Select {...{ options, value }} onChange={(selected) => onChange(selected.value)} className={styles.select} />
        </InlineField>
        <IconButton
          variant="secondary"
          name="times"
          aria-label="See all"
          onClick={() => onChange(ALL_VARIABLE_VALUE)}
        />
      </Stack>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    select: css({
      maxWidth: theme.spacing(64),
    }),
  };
}
