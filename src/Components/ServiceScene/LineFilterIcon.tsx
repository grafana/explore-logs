import { useTheme2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

interface Props {
  onCaseSensitiveToggle: (state: 'sensitive' | 'insensitive') => void;
  caseSensitive: boolean;
}

export const LineFilterIcon = (props: Props) => {
  const theme = useTheme2();
  const fill = props.caseSensitive ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme, fill);

  return (
    <span className={styles.container} title={`Case ${props.caseSensitive ? 'insensitive' : 'sensitive'} search`}>
      <svg
        onClick={() => props.onCaseSensitiveToggle(props.caseSensitive ? 'insensitive' : 'sensitive')}
        fill={fill}
        width="16"
        height="16"
        viewBox="0 0 16 16"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
          Aa
        </text>
      </svg>
    </span>
  );
};

const getStyles = (theme: GrafanaTheme2, fill: string) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
      marginLeft: theme.spacing.x0_5,
      cursor: 'pointer',
    }),
  };
};
