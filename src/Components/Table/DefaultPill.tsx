import React, { ReactElement } from 'react';
import { css, cx } from '@emotion/css';

import { Field, FieldType, GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { useTableCellContext } from 'Components/Table/Context/TableCellContext';
import { CellContextMenu } from 'Components/Table/CellContextMenu';
import { getFieldMappings } from 'Components/Table/Table';
import { LEVEL_NAME } from './constants';

interface DefaultPillProps {
  label: string;
  showColumns?: () => void;
  value: string | unknown | ReactElement;
  rowIndex: number;
  field: Field;
}

const getStyles = (theme: GrafanaTheme2, levelColor?: string) => ({
  activePillWrap: css({}),
  pillWrap: css({
    width: '100%',
  }),
  pill: css({
    border: `1px solid ${theme.colors.border.weak}`,
    '&:hover': {
      border: `1px solid ${theme.colors.border.strong}`,
    },
    marginRight: '5px',
    marginTop: '4px',
    marginLeft: '5px',
    padding: '2px 5px',
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'row-reverse',
    backgroundColor: 'transparent',

    paddingLeft: levelColor ? `${theme.spacing(0.75)}` : `2px`,

    '&:before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      height: '100%',
      width: `${theme.spacing(0.25)}`,
      backgroundColor: levelColor,
    },
  }),
  menu: css({
    width: '100%',
  }),
  menuItem: css({
    overflow: 'auto',
    textOverflow: 'ellipsis',
  }),
  menuItemText: css({
    width: '65px',
    display: 'inline-block',
  }),
});
export const DefaultPill = (props: DefaultPillProps) => {
  const { label, value } = props;
  const theme = useTheme2();
  const { cellIndex } = useTableCellContext();
  let levelColor;

  if (label === LEVEL_NAME) {
    const mappings = getFieldMappings().options;
    if (typeof value === 'string' && value in mappings) {
      levelColor = mappings[value].color;
    }
  }

  const isPillActive = cellIndex.index === props.rowIndex && props.field.name === cellIndex.fieldName;

  const styles = getStyles(theme, levelColor);
  return (
    <div className={cx(styles.pillWrap, isPillActive ? styles.activePillWrap : undefined)}>
      {!!value && (
        <>
          <span className={styles.pill}>
            <>{value}</>
          </span>
          {isPillActive && typeof value === 'string' && props.field.type !== FieldType.time && (
            <CellContextMenu label={props.label} value={value} pillType={'column'} />
          )}
        </>
      )}
    </div>
  );
};
