import { IconButtonVariant, Tooltip, useTheme2 } from '@grafana/ui';
import React from 'react';
import { colorManipulator, GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { LineFilterCaseSensitive } from './LineFilterScene';
import { getFocusStyles, getIconButtonBefore, getMouseFocusStyles } from '../../../services/mixins';

interface Props {
  onCaseSensitiveToggle: (state: LineFilterCaseSensitive) => void;
  caseSensitive: boolean;
}

export const LineFilterIconButton = (props: Props) => {
  const theme = useTheme2();
  const fill = props.caseSensitive ? theme.colors.text.maxContrast : theme.colors.text.disabled;
  const styles = getStyles(theme);
  const description = `${props.caseSensitive ? 'Disable' : 'Enable'} case match`;

  return (
    <Tooltip content={description}>
      <button
        onClick={() =>
          props.onCaseSensitiveToggle(
            props.caseSensitive ? LineFilterCaseSensitive.caseInsensitive : LineFilterCaseSensitive.caseSensitive
          )
        }
        className={styles.button}
        aria-label={description}
      >
        <svg fill={fill} width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
          <text fontSize="13" width="16" height="16" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
            Aa
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
  };
};
