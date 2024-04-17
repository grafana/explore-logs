import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { FieldNameMetaStore } from '@/components/Table/TableTypes';
import { LogsFrame } from '@/services/logsFrame';
import { useHistory } from 'react-router-dom';
import { TABLE_COLUMNS_URL_PARAM } from '@/components/Table/TableWrap';

type TableColumnsContextType = {
  // the current list of labels from the dataframe combined with UI metadata
  columns: FieldNameMetaStore;
  // The active search results
  filteredColumns?: FieldNameMetaStore;
  // Update the column state
  setColumns(newColumns: FieldNameMetaStore): void;
  // Update search state
  setFilteredColumns(newColumns?: FieldNameMetaStore): void;
  // WIP - sets the visibility of the drawer right now
  visible: boolean;
  setVisible: (v: boolean) => void;
  bodyState: LogLineState;
  setBodyState: (s: LogLineState) => void;
};

export enum LogLineState {
  text = 'text',
  labels = 'labels',
  auto = 'auto',
}

const TableColumnsContext = createContext<TableColumnsContextType>({
  columns: {},
  filteredColumns: {},
  setColumns: () => {},
  setFilteredColumns: () => {},
  setVisible: () => false,
  visible: false,
  bodyState: LogLineState.auto,
  setBodyState: () => {},
});

export const TableColumnContextProvider = ({
  children,
  initialColumns,
  logsFrame,
}: {
  children: ReactNode;
  initialColumns: FieldNameMetaStore;
  logsFrame: LogsFrame;
}) => {
  const [columns, setColumns] = useState<FieldNameMetaStore>(removeExtraColumns(initialColumns));
  const [bodyState, setBodyState] = useState<LogLineState>(LogLineState.auto);
  const [filteredColumns, setFilteredColumns] = useState<FieldNameMetaStore | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const history = useHistory();

  const handleSetColumns = useCallback((newColumns: FieldNameMetaStore) => {
    if (newColumns) {
      setColumns(removeExtraColumns(newColumns));
    }
  }, []);

  const handleSetVisible = useCallback((isVisible: boolean) => {
    setVisible(isVisible);
  }, []);

  // When the parent component recalculates new columns on dataframe change, we need to update or the column UI will be stale!
  useEffect(() => {
    if (initialColumns) {
      handleSetColumns(initialColumns);
    }
  }, [initialColumns, handleSetColumns]);

  // Handle url updates with react router or we'll get state sync errors with scenes
  useEffect(() => {
    const search = new URLSearchParams(location.search);
    const activeColumns = getColumnsForUrl(columns, logsFrame);
    if (activeColumns?.length) {
      search.set(TABLE_COLUMNS_URL_PARAM, JSON.stringify(activeColumns));
      history.push({ search: search.toString() });
      setFilteredColumns(columns);
    }
  }, [columns, history, logsFrame, setFilteredColumns]);

  return (
    <TableColumnsContext.Provider
      value={{
        bodyState,
        setBodyState,
        setFilteredColumns,
        filteredColumns,
        columns,
        setColumns: handleSetColumns,
        visible: visible,
        setVisible: handleSetVisible,
      }}
    >
      {children}
    </TableColumnsContext.Provider>
  );
};
/**
 * Filter out fields that shouldn't be exposed in the UI
 * @param columns
 */
const removeExtraColumns = (columns: FieldNameMetaStore): FieldNameMetaStore => {
  // Remove label Types
  if ('labelTypes' in columns) {
    const { labelTypes, ...columnsToSet }: FieldNameMetaStore = {
      ...columns,
    };
    return columnsToSet;
  }
  return columns;
};

function getColumnsForUrl(pendingLabelState: FieldNameMetaStore, logsFrame: LogsFrame) {
  if (!logsFrame) {
    console.warn('missing dataframe, cannot set url state');
    return;
  }
  // Get all active columns and sort by index
  const newColumnsArray = Object.keys(pendingLabelState)
    // Only include active filters
    .filter((key) => pendingLabelState[key]?.active)
    .sort((a, b) => {
      const pa = pendingLabelState[a];
      const pb = pendingLabelState[b];
      if (pa.index !== undefined && pb.index !== undefined) {
        return pa.index - pb.index; // sort by index
      }
      return 0;
    });

  const timeField = logsFrame.timeField;
  const bodyField = logsFrame.bodyField;

  if ((timeField && bodyField) || Object.keys(newColumnsArray).length) {
    const defaultColumns = [];
    if (timeField?.name) {
      defaultColumns.push(timeField.name);
    }
    if (bodyField?.name) {
      defaultColumns.push(bodyField.name);
    }

    // Update url state
    return Object.keys(newColumnsArray).length ? newColumnsArray : defaultColumns;
  }

  return [];
}

export const useTableColumnContext = () => {
  return useContext(TableColumnsContext);
};
