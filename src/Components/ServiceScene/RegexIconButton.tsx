import { useTheme2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export type RegexInputValue = 'regex' | 'match';
interface Props {
  onRegexToggle: (state: RegexInputValue) => void;
  regex: boolean;
}

export const RegexIconButton = (props: Props) => {
  const theme = useTheme2();
  const fill = props.regex ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme, fill);

  return (
    <button
      onClick={() => props.onRegexToggle(props.regex ? 'match' : 'regex')}
      className={styles.container}
      title={`${props.regex ? 'String comparison' : 'Regex matching'}`}
    >
      <svg fill={fill} width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
          .*
        </text>
      </svg>
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
