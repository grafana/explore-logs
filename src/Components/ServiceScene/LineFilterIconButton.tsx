import { Tooltip, useTheme2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { LineFilterCaseSensitive } from './LineFilterScene';

interface Props {
  onCaseSensitiveToggle: (state: LineFilterCaseSensitive) => void;
  caseSensitive: boolean;
}

export const LineFilterIconButton = (props: Props) => {
  const theme = useTheme2();
  const fill = props.caseSensitive ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme, fill);

  return (
    <button
      onClick={() =>
        props.onCaseSensitiveToggle(
          props.caseSensitive ? LineFilterCaseSensitive.caseInsensitive : LineFilterCaseSensitive.caseSensitive
        )
      }
      className={styles.container}
      aria-label={`Match case ${props.caseSensitive ? 'enabled' : 'disabled'}`}
    >
      <Tooltip content={`Match case ${props.caseSensitive ? 'enabled' : 'disabled'}`}>
        <svg fill={fill} width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
            Aa
          </text>
        </svg>
      </Tooltip>
    </button>
  );
};

const getStyles = (theme: GrafanaTheme2, fill: string) => {
  return {
    container: css({
      display: 'flex',
      justifyContent: 'center',
      marginLeft: theme.spacing.x0_5,
      cursor: 'pointer',
      appearance: 'none',
      border: 'none',
      background: 'none',
      padding: 0,
    }),
  };
};
