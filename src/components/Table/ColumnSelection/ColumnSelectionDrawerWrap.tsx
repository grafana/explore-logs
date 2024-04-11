import React from 'react';

import { ClickOutsideWrapper } from '@grafana/ui';

import { useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { LogsColumnSearch } from '@/components/Table/ColumnSelection/LogsColumnSearch';
import { LogsTableMultiSelect } from '@/components/Table/ColumnSelection/LogsTableMultiSelect';

import { FieldNameMetaStore } from '../TableTypes';

export function getReorderColumn(setColumns: (cols: FieldNameMetaStore) => void) {
  return (columns: FieldNameMetaStore, sourceIndex: number, destinationIndex: number) => {
    if (sourceIndex === destinationIndex) {
      return;
    }

    const pendingLabelState = { ...columns };

    const keys = Object.keys(pendingLabelState)
      .filter((key) => pendingLabelState[key].active)
      .map((key) => ({
        fieldName: key,
        index: pendingLabelState[key].index ?? 0,
      }))
      .sort((a, b) => a.index - b.index);

    const [source] = keys.splice(sourceIndex, 1);
    keys.splice(destinationIndex, 0, source);

    keys
      .filter((key) => key !== undefined)
      .forEach((key, index) => {
        pendingLabelState[key.fieldName].index = index;
      });

    // Set local state
    setColumns(pendingLabelState);
  };
}

export function ColumnSelectionDrawerWrap() {
  const { columns, setColumns, setVisible, filteredColumns, setFilteredColumns } = useTableColumnContext();
  const toggleColumn = (columnName: string) => {
    if (!columns || !(columnName in columns)) {
      console.warn('failed to get column', columns);
      return;
    }

    const length = Object.keys(columns).filter((c) => columns[c].active).length;
    const isActive = !columns[columnName].active ? true : undefined;

    let pendingLabelState: FieldNameMetaStore;
    if (isActive) {
      pendingLabelState = {
        ...columns,
        [columnName]: {
          ...columns[columnName],
          active: isActive,
          index: length,
        },
      };
    } else {
      pendingLabelState = {
        ...columns,
        [columnName]: {
          ...columns[columnName],
          active: false,
          index: undefined,
        },
      };
    }

    // Analytics
    // columnFilterEvent(columnName);

    // Set local state
    setColumns(pendingLabelState);

    // If user is currently filtering, update filtered state
    if (filteredColumns) {
      const active = !filteredColumns[columnName]?.active;
      let pendingFilteredLabelState: FieldNameMetaStore;
      if (active) {
        pendingFilteredLabelState = {
          ...filteredColumns,
          [columnName]: {
            ...filteredColumns[columnName],
            active: active,
            index: length,
          },
        };
      } else {
        pendingFilteredLabelState = {
          ...filteredColumns,
          [columnName]: {
            ...filteredColumns[columnName],
            active: false,
            index: undefined,
          },
        };
      }

      setFilteredColumns(pendingFilteredLabelState);
    }
  };

  const reorderColumn = getReorderColumn(setColumns);

  const clearSelection = () => {
    const pendingLabelState = { ...columns };
    let index = 0;
    Object.keys(pendingLabelState).forEach((key) => {
      const isDefaultField =
        pendingLabelState[key].type === 'BODY_FIELD' || pendingLabelState[key].type === 'TIME_FIELD';
      // after reset the only active fields are the special time and body fields
      pendingLabelState[key].active = isDefaultField;
      // reset the index
      pendingLabelState[key].index = isDefaultField ? index++ : undefined;
    });

    setColumns(pendingLabelState);
  };

  return (
    <ClickOutsideWrapper
      onClick={() => {
        setVisible(false);
        setFilteredColumns(columns);
      }}
      useCapture={true}
    >
      <LogsColumnSearch />
      <LogsTableMultiSelect
        toggleColumn={toggleColumn}
        filteredColumnsWithMeta={filteredColumns}
        columnsWithMeta={columns}
        clear={clearSelection}
        reorderColumn={reorderColumn}
      />
    </ClickOutsideWrapper>
  );
}
