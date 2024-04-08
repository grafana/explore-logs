import React, { ReactElement } from 'react';
import { css } from '@emotion/css';

import { FieldType, formattedValueToString, GrafanaTheme2, MappingType, ValueMap } from '@grafana/data';
import { CustomCellRendererProps, DataLinksContextMenu, getCellLinks, useTheme2 } from '@grafana/ui';
import { DefaultPill } from './DefaultPill';
import { DefaultCellWrapComponent } from './DefaultCellWrapComponent';

const getStyles = (theme: GrafanaTheme2, fieldType?: FieldType) => ({
  content: css({
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: fieldType === FieldType.number ? 'row-reverse' : 'row',
    textAlign: fieldType === FieldType.number ? 'right' : 'left',
    alignItems: 'flex-start',
    height: '100%',
    marginLeft: '5px',
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

export type CellIndex = {
  fieldName?: string;
  // If the field contains labels (like log line), we need to know which field (line) and which label (e.g. level)
  subFieldName?: string;
  index: number | null;
  numberOfMenuItems?: number;
};
export const DefaultCellComponent = (
  props: CustomCellRendererProps & {
    setVisible: (visible: boolean) => void;
    cellIndex: CellIndex;
    setActiveCellIndex: (cellIndex: CellIndex) => void;
  }
) => {
  let value = props.value;
  const field = props.field;
  const displayValue = field.display!(value);
  const theme = useTheme2();
  const styles = getStyles(theme, props.field.type);

  const { setVisible, cellIndex, setActiveCellIndex } = props;

  // We don't get back the full react.table row here, but the calling function only uses the index, which are in `CustomCellRendererProps`
  // @todo update def of Row in getCellLinks to {index: number} ?
  const row = { index: props.rowIndex };
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
        cellIndex={cellIndex}
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
      cellIndex={props.cellIndex}
    >
      <div className={styles.content}>
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

export const getFieldMappings = (): ValueMap => {
  return {
    options: {
      critical: {
        color: '#705da0',
        index: 0,
      },
      crit: {
        color: '#705da0',
        index: 1,
      },
      error: {
        color: '#e24d42',
        index: 2,
      },
      err: {
        color: '#e24d42',
        index: 3,
      },
      eror: {
        color: '#e24d42',
        index: 4,
      },
      warning: {
        color: '#FF9900',
        index: 5,
      },
      warn: {
        color: '#FF9900',
        index: 6,
      },
      info: {
        color: '#7eb26d',
        index: 7,
      },
      debug: {
        color: '#1f78c1',
        index: 8,
      },
      trace: {
        color: '#6ed0e0',
        index: 9,
      },
    },
    type: MappingType.ValueToText,
  };
};
