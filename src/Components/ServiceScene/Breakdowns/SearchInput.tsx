import { css } from '@emotion/css';
import { Icon, Input } from '@grafana/ui';
import React, { HTMLProps } from 'react';

interface Props extends HTMLProps<HTMLInputElement> {
  onClear(): void;
}

export const SearchInput = ({ value, onChange, placeholder, onClear }: Props) => {
  return (
    <Input
      value={value}
      onChange={onChange}
      suffix={value ? <Icon onClick={onClear} name={'x'} className={styles.clearIcon} /> : undefined}
      prefix={<Icon name="search" />}
      placeholder={placeholder}
    />
  );
};

const styles = {
  clearIcon: css({
    cursor: 'pointer',
  }),
};
