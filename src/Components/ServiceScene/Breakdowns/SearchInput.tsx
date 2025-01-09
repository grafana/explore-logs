import { css } from '@emotion/css';
import { Icon, IconButton, Input, useStyles2 } from '@grafana/ui';
import React, { HTMLProps } from 'react';
import { GrafanaTheme2 } from '@grafana/data';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'width' | 'prefix'> {
  onClear?: () => void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
}

export const SearchInput = ({ value, onChange, placeholder, onClear, suffix, ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <Input
      value={value}
      onChange={onChange}
      suffix={
        <span className={styles.suffixWrapper}>
          {onClear && value ? (
            <IconButton
              aria-label={'Clear search'}
              tooltip={'Clear search'}
              onClick={onClear}
              name="times"
              className={styles.clearIcon}
            />
          ) : undefined}
          {suffix && suffix}
        </span>
      }
      prefix={<Icon name="search" />}
      placeholder={placeholder}
      {...rest}
    />
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  suffixWrapper: css({
    gap: theme.spacing(0.5),
    display: 'inline-flex',
  }),
  clearIcon: css({
    cursor: 'pointer',
  }),
});
