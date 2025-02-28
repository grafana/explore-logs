import { css } from '@emotion/css';
import { Icon, IconButton, Input, useStyles2 } from '@grafana/ui';
import React, { HTMLProps } from 'react';
import { GrafanaTheme2 } from '@grafana/data';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'width' | 'prefix'> {
  onClear?: () => void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
  width?: number;
}

export const LineFilterInput = ({ value, onChange, placeholder, onClear, suffix, width, ...rest }: Props) => {
  const styles = useStyles2(getStyles);
  return (
    <Input
      rows={2}
      width={width}
      value={value}
      onChange={onChange}
      suffix={
        <span className={styles.suffixWrapper}>
          {onClear && value ? (
            <IconButton
              aria-label={'Clear line filter'}
              tooltip={'Clear line filter'}
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
