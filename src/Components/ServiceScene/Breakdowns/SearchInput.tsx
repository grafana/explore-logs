import { css } from '@emotion/css';
import { Icon, IconButton, Input } from '@grafana/ui';
import React, { HTMLProps } from 'react';

interface Props extends Omit<HTMLProps<HTMLInputElement>, 'width' | 'prefix'> {
  onClear(): void;
  suffix?: React.ReactNode;
  prefix?: React.ReactNode;
}

export const SearchInput = ({ value, onChange, placeholder, onClear, suffix, ...rest }: Props) => {
  return (
    <Input
      value={value}
      onChange={onChange}
      suffix={
        <>
          {value ? (
            <IconButton
              aria-label={'Clear search'}
              tooltip={'Clear search'}
              onClick={onClear}
              name="times"
              className={styles.clearIcon}
            />
          ) : undefined}
          {suffix && suffix}
        </>
      }
      prefix={<Icon name="search" />}
      placeholder={placeholder}
      {...rest}
    />
  );
};

const styles = {
  clearIcon: css({
    cursor: 'pointer',
  }),
};
