import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollSync } from 'react-scroll-sync';
import { css } from '@emotion/css';
import { lastValueFrom } from 'rxjs';

import {
  applyFieldOverrides,
  CustomTransformOperator,
  DataFrame,
  DataFrameType,
  DataTransformerConfig,
  Field,
  FieldType,
  FieldWithIndex,
  GrafanaTheme2,
  Labels,
  MappingType,
  transformDataFrame,
  ValueMap,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { TableCellHeight, TableColoredBackgroundCellOptions } from '@grafana/schema';
import {
  Drawer,
  Icon,
  Table as GrafanaTable,
  TableCellDisplayMode,
  TableCustomCellOptions,
  useTheme2,
} from '@grafana/ui';

import { TableCellContextProvider } from '@/components/Context/TableCellContext';
import { useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { TableHeaderContextProvider, useTableHeaderContext } from '@/components/Context/TableHeaderContext';
import {
  ColumnSelectionDrawerWrap,
  useReorderColumn,
} from '@/components/Table/ColumnSelection/ColumnSelectionDrawerWrap';
import { DefaultCellComponent } from '@/components/Table/DefaultCellComponent';
import { LogLineCellComponent } from '@/components/Table/LogLineCellComponent';
import { LogsTableHeader, LogsTableHeaderProps } from '@/components/Table/LogsTableHeader';
import { FieldName, FieldNameMeta, FieldNameMetaStore } from '@/components/Table/TableTypes';
import { guessLogsFieldTypeForValue } from '@/components/Table/TableWrap';
import { DATAPLANE_BODY_NAME, DATAPLANE_ID_NAME, LogsFrame } from '@/services/logsFrame';
import { useScenesTableContext } from '@/components/Context/ScenesTableContext';

interface Props {
  height: number;
  timeZone: string;
  logsFrame: LogsFrame;
  width: number;
  labels: Labels[];
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    position: 'relative',
  }),
  tableWrap: css({
    '.cellActions': {
      // Hacky but without inspect turned on the table will change the width of the row on hover, but we don't want the default icons to show
      display: 'none !important',
    },
  }),
});

function LogsTableHeaderWrap(props: {
  props: LogsTableHeaderProps;
  removeColumn: () => void;
  openColumnManagementDrawer: () => void;

  // Moves the current column forward or backward one index
  slideLeft: () => void;
  slideRight: () => void;
}) {
  const { setHeaderMenuActive } = useTableHeaderContext();

  return (
    <LogsTableHeader {...props.props} myProp={'hallo'}>
      <div>
        <a onClick={props.removeColumn}>
          <Icon name={'minus'} size={'xl'} />
          Remove column
        </a>
      </div>
      <div>
        <a
          onClick={() => {
            props.openColumnManagementDrawer();
            setHeaderMenuActive(false);
          }}
        >
          <Icon name={'columns'} size={'xl'} />
          Manage columns
        </a>
      </div>
      <div>
        <a onClick={props.slideLeft}>
          <Icon name={'forward'} size={'xl'} />
          Move forward
        </a>
      </div>
      <div>
        <a onClick={props.slideRight}>
          <Icon name={'backward'} size={'xl'} />
          Move backward
        </a>
      </div>
    </LogsTableHeader>
  );
}

function TableAndContext(props: { data: DataFrame; height: number; width: number; selectedLine?: number }) {
  return (
    <GrafanaTable
      initialRowIndex={props.selectedLine}
      cellHeight={TableCellHeight.Sm}
      data={props.data}
      height={props.height}
      width={props.width}
      footerOptions={{ show: true, reducer: ['count'], countRows: true }}
    />
  );
}

export const Table = (props: Props) => {
  const { height, timeZone, logsFrame, width, labels } = props;
  const theme = useTheme2();
  const styles = getStyles(theme);

  const [tableFrame, setTableFrame] = useState<DataFrame | undefined>(undefined);
  const { columns, visible, setVisible, setFilteredColumns, setColumns } = useTableColumnContext();
  const reorderColumn = useReorderColumn();
  const { selectedLine } = useScenesTableContext();

  const templateSrv = getTemplateSrv();
  const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);

  const hideColumn = (field: Field) => {
    const pendingColumnState = { ...columns };
    pendingColumnState[field.name].active = false;
    setColumns(pendingColumnState);
  };

  const prepareTableFrame = useCallback(
    (frame: DataFrame): DataFrame => {
      if (!frame.length) {
        return frame;
      }

      const [frameWithOverrides] = applyFieldOverrides({
        data: [frame],
        timeZone: timeZone,
        theme: theme,
        replaceVariables: replace,
        fieldConfig: {
          defaults: {
            custom: {},
          },
          overrides: [],
        },
      });

      // `getLinks` and `applyFieldOverrides` are taken from TableContainer.tsx
      for (const [index, field] of frameWithOverrides.fields.entries()) {
        // If it's a string, then try to guess for a better type for numeric support in viz
        field.type =
          field.type === FieldType.string ? guessLogsFieldTypeForField(field) ?? FieldType.string : field.type;

        field.config = {
          ...field.config,
          custom: {
            inspect: true,
            filterable: true, // This sets the columns to be filterable
            headerComponent: (props: LogsTableHeaderProps) => (
              <TableHeaderContextProvider>
                <LogsTableHeaderWrap
                  props={props}
                  removeColumn={() => {
                    hideColumn(props.field);
                  }}
                  openColumnManagementDrawer={() => setVisible(true)}
                  slideLeft={() => reorderColumn(index, index + 1)}
                  slideRight={() => reorderColumn(index, index - 1)}
                />
              </TableHeaderContextProvider>
            ),
            width: getInitialFieldWidth(field, columns),
            cellOptions: getTableCellOptions(field, labels),
            ...field.config.custom,
          },
          // This sets the individual field value as filterable
          // filterable: isFieldFilterable(field, logsFrame?.bodyField.name ?? '', logsFrame?.timeField.name ?? ''),
          filterable: true,
        };
      }

      return frameWithOverrides;
    },
    // This function is building the table dataframe that will be transformed, even though the components within the dataframe (cells, headers) can mutate the dataframe!
    // If we try to update the dataframe whenever the columns are changed (which are rebuilt using this dataframe after being transformed), react will infinitely update frame -> columns -> frame -> ...
    // Maybe
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timeZone, theme, labels]
  );

  // prepare dataFrame
  useEffect(() => {
    const prepare = async () => {
      const transformations: Array<DataTransformerConfig | CustomTransformOperator> = getExtractFieldsTransform(
        logsFrame.raw
      );

      let labelFilters = buildColumnsWithMeta(columns);

      const labelFiltersTransform = getOrganizeFieldsTransform(labelFilters);
      if (labelFiltersTransform) {
        transformations.push(labelFiltersTransform);
      } else {
        const specialFields = {
          time: logsFrame.timeField,
          body: logsFrame.bodyField,
          extraFields: logsFrame.extraFields,
        };
        if (specialFields && specialFields.body !== undefined && specialFields.time !== undefined) {
          transformations.push(
            getDefaultStateOrganizeFieldsTransform(
              specialFields as {
                time: FieldWithIndex;
                body: FieldWithIndex;
              }
            )
          );
        }
      }

      if (transformations.length > 0) {
        const transformedDataFrame: DataFrame[] = await lastValueFrom(
          // @ts-ignore
          transformDataFrame(transformations, [logsFrame.raw])
        );
        const tableFrame = prepareTableFrame(transformedDataFrame[0]);
        setTableFrame(tableFrame);
      } else {
        setTableFrame(prepareTableFrame(logsFrame.raw));
      }
    };
    prepare();
  }, [logsFrame.raw, logsFrame.bodyField, logsFrame.timeField, logsFrame.extraFields, prepareTableFrame, columns]);

  if (!tableFrame) {
    return <></>;
  }

  const idField = logsFrame.raw.fields.find((field) => field.name === DATAPLANE_ID_NAME);
  const lineIndex = idField?.values.findIndex((v) => v === selectedLine?.id);

  return (
    <div className={styles.section}>
      {visible && (
        <Drawer
          size={'sm'}
          onClose={() => {
            setVisible(false);
            setFilteredColumns(columns);
          }}
        >
          <ColumnSelectionDrawerWrap />
        </Drawer>
      )}

      <div className={styles.tableWrap}>
        <TableCellContextProvider>
          <ScrollSync horizontal={true} vertical={false} proportional={false}>
            <TableAndContext
              selectedLine={lineIndex ?? selectedLine?.row}
              data={tableFrame}
              height={height}
              width={width}
            />
          </ScrollSync>
        </TableCellContextProvider>
      </div>
    </div>
  );
};

function getDefaultStateOrganizeFieldsTransform(specialFields: { time: FieldWithIndex; body: FieldWithIndex }) {
  return {
    id: 'organize',
    options: {
      indexByName: {
        [specialFields.time.name]: 0,
        [specialFields.body.name]: 1,
      },
      includeByName: {
        [specialFields.body.name]: true,
        [specialFields.time.name]: true,
      },
    },
  };
}

function guessLogsFieldTypeForField(field: Field): FieldType | undefined {
  // 1. Use the column name to guess
  if (field.name) {
    const name = field.name.toLowerCase();
    if (name === 'date' || name === 'time') {
      return FieldType.time;
    }
  }

  // 2. Check the first non-null value
  for (let i = 0; i < field.values.length; i++) {
    const v = field.values[i];
    if (v != null) {
      return guessLogsFieldTypeForValue(v);
    }
  }

  // Could not find anything
  return undefined;
}

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

function buildColumnsWithMeta(columnsWithMeta: Record<FieldName, FieldNameMeta>) {
  // Create object of label filters to include columns selected by the user
  let labelFilters: Record<FieldName, number> = {};
  Object.keys(columnsWithMeta)
    .filter((key) => columnsWithMeta[key].active)
    .forEach((key) => {
      const index = columnsWithMeta[key].index;
      // Index should always be defined for any active column
      if (index !== undefined) {
        labelFilters[key] = index;
      }
    });

  return labelFilters;
}

function getOrganizeFieldsTransform(labelFilters: Record<FieldName, number>) {
  let labelFiltersInclude: Record<FieldName, boolean> = {};

  for (const key in labelFilters) {
    labelFiltersInclude[key] = true;
  }

  if (Object.keys(labelFilters).length > 0) {
    return {
      id: 'organize',
      options: {
        indexByName: labelFilters,
        includeByName: labelFiltersInclude,
      },
    };
  }
  return null;
}

export function getExtractFieldsTransform(dataFrame: DataFrame) {
  return dataFrame.fields
    .filter((field: Field & { typeInfo?: { frame: string } }) => {
      const isFieldLokiLabels =
        field.typeInfo?.frame === 'json.RawMessage' &&
        field.name === 'labels' &&
        dataFrame?.meta?.type !== DataFrameType.LogLines;
      const isFieldDataplaneLabels =
        field.name === 'labels' && field.type === FieldType.other && dataFrame?.meta?.type === DataFrameType.LogLines;
      return isFieldLokiLabels || isFieldDataplaneLabels;
    })
    .flatMap((field: Field) => {
      return [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: field.name,
          },
        },
      ];
    });
}

function getTableCellOptions(
  field: Field,
  labels: Labels[]
): TableCustomCellOptions | TableColoredBackgroundCellOptions {
  if (field.name === DATAPLANE_BODY_NAME) {
    return {
      cellComponent: (props) => <LogLineCellComponent {...props} labels={labels[props.rowIndex]} />,
      type: TableCellDisplayMode.Custom,
    };
  }

  return {
    cellComponent: DefaultCellComponent,
    type: TableCellDisplayMode.Custom,
  };
}

function getInitialFieldWidth(field: Field, columns: FieldNameMetaStore): number | undefined {
  const minWidth = 90;
  const maxWidth = 220;
  // Time fields have consistent widths
  if (field.type === FieldType.time) {
    return 200;
  }

  const columnMeta = columns[field.name];

  if (columnMeta === undefined) {
    return undefined;
  }

  const maxLength = Math.max(columnMeta.maxLength ?? 0, field.name.length);
  if (columnMeta.maxLength) {
    // Super rough estimate, about 8px per char, and 50px for some padding and space for the header icons.
    // I guess to be a little tighter we could only add the extra padding IF the field name is longer then the longest value
    return Math.min(Math.max(maxLength * 8 + 50, minWidth), maxWidth);
  }

  return undefined;
}
