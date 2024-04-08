import React, { PropsWithChildren } from 'react';
import { css, cx } from '@emotion/css';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { CellIndex } from './DefaultCellComponent';

interface DefaultCellWrapComponentProps {}

interface Props extends PropsWithChildren<DefaultCellWrapComponentProps> {
  rowIndex: number;
  field: Field;
  onClick?: () => void;
  onMouseIn?: () => void;
  cellIndex: CellIndex;
  onMouseOut?: () => void;
}

const getStyles = (theme: GrafanaTheme2, bgColor?: string, numberOfMenuItems?: number) => ({
  active: css({
    // Save 20px for context menu
    height: `calc(${100}% + 20px)`,
    zIndex: theme.zIndex.tooltip,
    background: 'transparent',
  }),
  wrap: css({
    position: 'absolute',
    overflowX: 'hidden',
    whiteSpace: 'nowrap',
    width: '100%',
    height: '100%',
    left: 0,
    top: 0,
    margin: 'auto',
    background: bgColor ?? 'transparent',
  }),
});

export const DefaultCellWrapComponent = (props: Props) => {
  return (
    <CellWrapInnerComponent
      onMouseOut={props.onMouseOut}
      onMouseIn={props.onMouseIn}
      onClick={props.onClick}
      field={props.field}
      rowIndex={props.rowIndex}
      cellIndex={props.cellIndex}
    >
      {props.children}
    </CellWrapInnerComponent>
  );
};

const CellWrapInnerComponent = (props: Props) => {
  const theme = useTheme2();
  const cellIndex = props.cellIndex;
  const styles = getStyles(theme, undefined, cellIndex?.numberOfMenuItems);

  return (
    <div
      onMouseLeave={props.onMouseOut}
      onMouseEnter={props.onMouseIn}
      onClick={props.onClick}
      className={
        cellIndex.index === props.rowIndex && cellIndex.fieldName === props.field.name
          ? cx(styles.wrap, styles.active)
          : styles.wrap
      }
    >
      {props.children}
    </div>
  );
};
