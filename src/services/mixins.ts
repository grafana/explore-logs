import { GrafanaTheme2 } from '@grafana/data';

// from /grafana/grafana/packages/grafana-ui/src/themes/mixins.ts
export function getFocusStyles(theme: GrafanaTheme2) {
  return {
    outline: '2px dotted transparent',
    outlineOffset: '2px',
    boxShadow: `0 0 0 2px ${theme.colors.background.canvas}, 0 0 0px 4px ${theme.colors.primary.main}`,
    transitionTimingFunction: `cubic-bezier(0.19, 1, 0.22, 1)`,
    transitionDuration: '0.2s',
    transitionProperty: 'outline, outline-offset, box-shadow',
  };
}

export function getMouseFocusStyles(theme: GrafanaTheme2) {
  return {
    outline: 'none',
    boxShadow: `none`,
  };
}

export function getIconButtonBefore(hoverSize: number, theme: GrafanaTheme2) {
  return {
    zIndex: '-1',
    position: 'absolute',
    opacity: '0',
    width: `${hoverSize}px`,
    height: `${hoverSize}px`,
    borderRadius: theme.shape.radius.default,
    content: '""',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transitionDuration: '0.2s',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
      transitionProperty: 'opacity',
    },
  };
}
