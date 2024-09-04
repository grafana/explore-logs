import { Icon, useTheme2 } from '@grafana/ui';
import React from 'react';

interface Props {
  onCaseSensitiveToggle: (state: 'sensitive' | 'insensitive') => void;
  caseSensitive: boolean;
}

export const LineFilterIcon = (props: Props) => {
  const theme = useTheme2();

  return (
    <>
      <Icon
        name={'font'}
        onClick={() => props.onCaseSensitiveToggle(props.caseSensitive ? 'insensitive' : 'sensitive')}
        color={props.caseSensitive ? theme.colors.text.maxContrast : theme.colors.text.disabled}
        title={`Case ${props.caseSensitive ? 'insensitive' : 'sensitive'} search`}
      />
    </>
  );
};
