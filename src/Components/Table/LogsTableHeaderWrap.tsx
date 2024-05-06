import { LogsTableHeader, LogsTableHeaderProps } from 'Components/Table/LogsTableHeader';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { useTableHeaderContext } from 'Components/Table/Context/TableHeaderContext';
import { LogLineState, useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { Icon } from '@grafana/ui';
import React, { useCallback } from 'react';
import { Field } from '@grafana/data';
import { DATAPLANE_BODY_NAME } from '../../services/logsFrame';

export function LogsTableHeaderWrap(props: {
  headerProps: LogsTableHeaderProps;
  openColumnManagementDrawer: () => void;

  // Moves the current column forward or backward one index
  slideLeft: (cols: FieldNameMetaStore) => void;
  slideRight: (cols: FieldNameMetaStore) => void;
}) {
  const { setHeaderMenuActive } = useTableHeaderContext();
  const { columns, setColumns, bodyState, setBodyState } = useTableColumnContext();

  const hideColumn = useCallback(
    (field: Field) => {
      const pendingColumnState = { ...columns };

      const columnsThatNeedIndexUpdate = Object.keys(pendingColumnState)
        .filter((col) => {
          const columnIndex = pendingColumnState[col].index;
          const fieldIndex = pendingColumnState[field.name].index;
          return pendingColumnState[col].active && fieldIndex && columnIndex && columnIndex > fieldIndex;
        })
        .map((cols) => pendingColumnState[cols]);

      columnsThatNeedIndexUpdate.forEach((col) => {
        if (col.index !== undefined) {
          col.index--;
        }
      });

      pendingColumnState[field.name].active = false;
      pendingColumnState[field.name].index = undefined;
      setColumns(pendingColumnState);
    },
    [columns, setColumns]
  );

  const isBodyField = props.headerProps.field.name === DATAPLANE_BODY_NAME;

  return (
    <LogsTableHeader {...props.headerProps}>
      <div>
        <a onClick={() => hideColumn(props.headerProps.field)}>
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
        <a onClick={() => props.slideLeft(columns)}>
          <Icon name={'forward'} size={'xl'} />
          Move forward
        </a>
      </div>
      <div>
        <a onClick={() => props.slideRight(columns)}>
          <Icon name={'backward'} size={'xl'} />
          Move backward
        </a>
      </div>
      {isBodyField && (
        <div>
          <a
            onClick={() => {
              if (bodyState === LogLineState.text) {
                setBodyState(LogLineState.labels);
              } else {
                setBodyState(LogLineState.text);
              }
            }}
          >
            {bodyState === LogLineState.text ? (
              <Icon name={'brackets-curly'} size={'xl'} />
            ) : (
              <Icon name={'text-fields'} size={'xl'} />
            )}

            {bodyState === LogLineState.text ? 'Show labels' : 'Show log text'}
          </a>
        </div>
      )}
    </LogsTableHeader>
  );
}
