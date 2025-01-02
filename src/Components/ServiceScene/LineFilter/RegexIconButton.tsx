import { IconButtonVariant, Tooltip, useTheme2 } from '@grafana/ui';
import React from 'react';
import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { getFocusStyles, getIconButtonBefore, getMouseFocusStyles } from '../../../services/mixins';

export type RegexInputValue = 'regex' | 'match';
interface Props {
  onRegexToggle: (state: RegexInputValue) => void;
  regex: boolean;
}

export const RegexIconButton = (props: Props) => {
  const theme = useTheme2();
  const fill = props.regex ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme);
  const description = `${props.regex ? 'Disable' : 'Enable'} regex`;

  return (
    <Tooltip content={description}>
      <button
        onClick={() => props.onRegexToggle(props.regex ? 'match' : 'regex')}
        className={cx(styles.button, props.regex ? styles.active : null)}
        aria-label={description}
      >
        <svg fill={fill} width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
            .*
          </text>
        </svg>
      </button>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2, variant: IconButtonVariant = 'secondary') => {
  const hoverSize = 16 + theme.spacing.gridSize;

  return {
    button: css({
      zIndex: 0,
      position: 'relative',
      margin: `0 ${theme.spacing.x0_5} 0 ${theme.spacing.x0_5}`,
      boxShadow: 'none',
      border: 'none',
      display: 'inline-flex',
      background: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 0,
      color: theme.colors.text.primary,

      '&:before': {
        ...getIconButtonBefore(hoverSize, theme),
        position: 'absolute',
      },

      '&:hover': {
        '&:before': {
          backgroundColor:
            variant === 'secondary'
              ? theme.colors.action.hover
              : colorManipulator.alpha(theme.colors.text.primary, 0.12),
          opacity: 1,
        },
      },

      '&:focus, &:focus-visible': getFocusStyles(theme),
      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),
    }),
    active: css({
      '&:before': {
        backgroundColor:
          variant === 'secondary' ? theme.colors.action.hover : colorManipulator.alpha(theme.colors.text.primary, 0.12),
        opacity: 1,
      },
      '&:hover': {
        '&:before': {
          backgroundColor: 'none',
          opacity: 0,
        },
      },
    }),
  };
};
