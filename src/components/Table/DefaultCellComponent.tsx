import React, { ReactElement } from 'react';
import { Row } from 'react-table';
import { css } from '@emotion/css';

import { FieldType, formattedValueToString, GrafanaTheme2 } from '@grafana/data';
import { CustomCellRendererProps, DataLinksContextMenu, getCellLinks, useTheme2 } from '@grafana/ui';

import { useTableCellContext } from '@/components/Context/TableCellContext';
import { useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { DefaultCellWrapComponent } from '@/components/Table/DefaultCellWrapComponent';
import { DefaultPill } from '@/components/Table/DefaultPill';
import { getFieldMappings } from '@/components/Table/Table';
import { LineActionIcons } from '@/components/Table/LineActionIcons';

const getStyles = (theme: GrafanaTheme2, fieldType?: FieldType) => ({
  flexWrap: css({
    display: 'flex',
    alignItems: 'flex-start',
    flexDirection: fieldType === FieldType.number ? 'row-reverse' : 'row',
    textAlign: fieldType === FieldType.number ? 'right' : 'left',
  }),
  content: css({
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    height: '100%',
  }),
  linkWrapper: css({
    color: theme.colors.text.link,
    marginTop: '7px',
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});

export function getBgColorForCell(props: CustomCellRendererProps): string | undefined {
  // This solution will only color the cell if it is the level field.
  const mappings = getFieldMappings().options;

  const value: string = props.field.values[props.rowIndex];
  if (props.field.name === 'level' && value in mappings) {
    return mappings[value].color;
  }

  return undefined;
}

interface DefaultCellComponentCustomProps {
  fieldIndex: number;
}
export const DefaultCellComponent = (props: CustomCellRendererProps & DefaultCellComponentCustomProps) => {
  let value = props.value;
  const field = props.field;
  const displayValue = field.display!(value);
  const theme = useTheme2();
  const styles = getStyles(theme, props.field.type);
  const { setVisible } = useTableColumnContext();
  const { cellIndex, setActiveCellIndex } = useTableCellContext();

  // We don't get back the full react.table row here, but the calling function only uses the index, which are in `CustomCellRendererProps`
  // @todo update def of Row in getCellLinks to {index: number} ?
  const row = { index: props.rowIndex } as Row;
  const hasLinks = Boolean(getCellLinks(props.field, row)?.length);

  if (value === null) {
    return <></>;
  }

  if (React.isValidElement(props.value)) {
    value = props.value;
  } else if (typeof value === 'object') {
    value = JSON.stringify(props.value);
  } else {
    value = formattedValueToString(displayValue);
  }

  const renderValue = (value: string | unknown | ReactElement, label: string) => {
    return (
      <DefaultPill
        field={props.field}
        rowIndex={props.rowIndex}
        showColumns={() => setVisible(true)}
        label={label}
        value={value}
      />
    );
  };

  return (
    <DefaultCellWrapComponent
      onClick={() => {
        if (props.rowIndex === cellIndex.index && props.field.name === cellIndex.fieldName) {
          return setActiveCellIndex({ index: null });
        }
        return setActiveCellIndex({ index: props.rowIndex, fieldName: props.field.name, numberOfMenuItems: 3 });
      }}
      field={props.field}
      rowIndex={props.rowIndex}
    >
      <div className={styles.content}>
        {props.fieldIndex === 0 && <LineActionIcons value={value} rowIndex={props.rowIndex} />}
        <div className={styles.flexWrap}></div>

        {!hasLinks && renderValue(value, field.name)}

        {hasLinks && field.getLinks && (
          <DataLinksContextMenu links={() => getCellLinks(field, row) ?? []}>
            {(api) => {
              if (api.openMenu) {
                return (
                  <div className={styles.linkWrapper} onClick={api.openMenu}>
                    {renderLink(value)}
                  </div>
                );
              } else {
                return <div className={styles.linkWrapper}>{renderLink(value)}</div>;
              }
            }}
          </DataLinksContextMenu>
        )}
      </div>
    </DefaultCellWrapComponent>
  );
};

export const renderLink = (value: string | unknown | ReactElement) => {
  if (value !== null) {
    return <>{value}</>;
  }
  return undefined;
};
