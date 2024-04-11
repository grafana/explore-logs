import React from 'react';
import { Row } from 'react-table';
import { css, cx } from '@emotion/css';

import { DataFrame, Field, FieldType, getLinksSupplier, GrafanaTheme2, LinkModel, ScopedVars } from '@grafana/data';
import { getCellLinks, useTheme2 } from '@grafana/ui';

import { useTableCellContext } from '@/components/Context/TableCellContext';
import { CellContextMenu } from '@/components/Table/CellContextMenu';
import { getFieldMappings } from '@/components/Table/Table';
import { FieldNameMetaStore } from '@/components/Table/TableTypes';

interface LogLinePillProps {
  originalField?: Field;
  field?: Field;
  columns: FieldNameMetaStore;
  showColumn: (label: string) => void;
  label: string;
  showColumns: () => void;
  rowIndex: number;
  frame: DataFrame;
  originalFrame: DataFrame | undefined;
  isDerivedField: boolean;
  value: string;
}

const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  pill: css({
    flex: '0 1 auto',
    marginLeft: '5px',
    marginRight: '5px',
    padding: '2px 5px',
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    marginTop: '4px',
  }),
  activePill: css({}),
  valueWrap: css({
    padding: '0 3px',
    border: `1px solid ${theme.colors.background.secondary}`,
    boxShadow: `-2px 2px 5px 0px ${theme.colors.background.secondary}`,
    backgroundColor: bgColor ?? 'transparent',
    cursor: 'pointer',

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

  let bgColor;
  if (props.label === 'level') {
    const mappings = getFieldMappings().options;
    if (props.value in mappings) {
      bgColor = mappings[props.value].color;
    }
  }

  const styles = getStyles(theme, bgColor);

  return (
    <span className={cx(styles.pill, props.menuActive ? styles.activePill : undefined)} onClick={props.onClick}>
      <span className={styles.valueWrap}>
        {props.label}={props.value}
      </span>
      {props.menuActive && (
        <CellContextMenu
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
  const { showColumn, label } = props;
  const { cellIndex, setActiveCellIndex } = useTableCellContext();
  const value = props.value;

  // Need untransformed frame for links?
  const field = props.field;

  if (!field || field?.type === FieldType.other) {
    return null;
  }
  const row = { index: props.rowIndex } as Row;

  if (props.originalField && props.isDerivedField && props.originalFrame) {
    props.originalField.getLinks = getLinksSupplier(
      props.originalFrame,
      props.originalField,
      {
        __value: {
          value: {
            raw: value,
          },
          text: 'Raw value',
        },
      },
      interpolateDerivedField
    );
  }

  const links = props.originalField && getCellLinks(props.originalField, row);

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
      onClickAdd={() => showColumn(label)}
      links={links}
    />
  );
};

function interpolateDerivedField(value: string, scopedVars?: ScopedVars, format?: string | Function): string {
  // @todo this is a hack!
  // I cannot seem to figure out how to properly get the link without calling DataLinksContextMenu
  if (value === '${__value.raw}') {
    return scopedVars?.__value?.value?.raw;
  }
  return value;
}
