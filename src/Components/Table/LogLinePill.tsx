import React, { useMemo } from 'react';
import { Row } from 'react-table';
import { css, cx } from '@emotion/css';

import { DataFrame, Field, FieldType, getLinksSupplier, GrafanaTheme2, LinkModel } from '@grafana/data';
import { getCellLinks, useTheme2 } from '@grafana/ui';

import { useTableCellContext } from 'Components/Table/Context/TableCellContext';
import { CellContextMenu } from 'Components/Table/CellContextMenu';
import { getFieldMappings } from 'Components/Table/Table';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { getTemplateSrv } from '@grafana/runtime';
import { LEVEL_NAME } from './Constants';

interface LogLinePillProps {
  originalField?: Field;
  field?: Field;
  columns: FieldNameMetaStore;
  label: string;
  showColumns: () => void;
  rowIndex: number;
  frame: DataFrame;
  originalFrame: DataFrame | undefined;
  isDerivedField: boolean;
  value: string;
}

const getStyles = (theme: GrafanaTheme2, levelColor?: string) => ({
  pill: css({
    flex: '0 1 auto',
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.25)}`,
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    marginTop: theme.spacing(0.5),
  }),
  activePill: css({}),
  valueWrap: css({
    border: `1px solid ${theme.colors.background.secondary}`,
    boxShadow: `-2px 2px 5px 0px ${theme.colors.background.secondary}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    position: 'relative',

    paddingRight: `${theme.spacing(0.5)}`,
    paddingLeft: levelColor ? `${theme.spacing(0.75)}` : `${theme.spacing(0.5)}`,

    '&:before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: 0,
      height: '100%',
      width: `${theme.spacing(0.25)}`,
      backgroundColor: levelColor,
    },

    '&:hover': {
      border: `1px solid ${theme.colors.border.strong}`,
    },
  }),
});

function LogLinePillValue(props: {
  fieldType?: 'derived';
  onClick: () => void;
  label: string;
  value: string;
  menuActive: boolean;
  onClickAdd: () => void;
  links?: LinkModel[];
}) {
  const theme = useTheme2();

  let levelColor;
  if (props.label === LEVEL_NAME) {
    const mappings = getFieldMappings().options;
    if (props.value in mappings) {
      levelColor = mappings[props.value].color;
    }
  }

  const styles = getStyles(theme, levelColor);

  return (
    <span className={cx(styles.pill, props.menuActive ? styles.activePill : undefined)} onClick={props.onClick}>
      <span className={styles.valueWrap}>
        {props.label}={props.value}
      </span>
      {props.menuActive && (
        <CellContextMenu
          pillType={'logPill'}
          fieldType={props.fieldType}
          links={props.links}
          label={props.label}
          value={props.value}
          showColumn={props.onClickAdd}
        />
      )}
    </span>
  );
}

export const LogLinePill = (props: LogLinePillProps) => {
  const { label } = props;
  const { cellIndex, setActiveCellIndex } = useTableCellContext();
  const { columns, setColumns } = useTableColumnContext();
  const value = props.value;
  const templateSrv = getTemplateSrv();
  const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);

  // Need untransformed frame for links?
  const field = props.field;

  if (!field || field?.type === FieldType.other) {
    return null;
  }
  const row = { index: props.rowIndex } as Row;

  if (props.originalField && props.isDerivedField && props.originalFrame) {
    props.originalField.getLinks = getLinksSupplier(props.originalFrame, props.originalField, {}, replace);
  }

  const links = props.originalField && getCellLinks(props.originalField, row);

  /**
   * This Could be moved?
   * Callback called by the pill context menu
   * @param fieldName
   */
  const addFieldToColumns = (fieldName: string) => {
    const pendingColumns = { ...columns };

    const length = Object.keys(columns).filter((c) => columns[c].active).length;
    if (pendingColumns[fieldName].active) {
      pendingColumns[fieldName].active = false;
      pendingColumns[fieldName].index = undefined;
    } else {
      pendingColumns[fieldName].active = true;
      pendingColumns[fieldName].index = length;
    }

    setColumns(pendingColumns);
  };

  return (
    <LogLinePillValue
      onClick={() => {
        if (
          props.rowIndex === cellIndex.index &&
          field.name === cellIndex.fieldName &&
          label === cellIndex.subFieldName
        ) {
          return setActiveCellIndex({ index: null });
        }

        return setActiveCellIndex({
          index: props.rowIndex,
          fieldName: field.name,
          subFieldName: label,
          numberOfMenuItems: props.isDerivedField ? 2 : 3,
        });
      }}
      menuActive={
        cellIndex.index === props.rowIndex && cellIndex.fieldName === field.name && cellIndex.subFieldName === label
      }
      fieldType={props.isDerivedField ? 'derived' : undefined}
      label={label}
      value={value}
      onClickAdd={() => addFieldToColumns(label)}
      links={links}
    />
  );
};
