import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { FieldNameMetaStore } from '@/components/Table/TableTypes';
import { LogsFrame } from '@/services/logsFrame';
import { useScenesTableContext } from '@/components/Context/ScenesTableContext';

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
};

const TableColumnsContext = createContext<TableColumnsContextType>({
  columns: {},
  filteredColumns: {},
  setColumns: () => {},
  setFilteredColumns: () => {},
  setVisible: () => false,
  visible: false,
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
  const [columns, setColumns] = useState<FieldNameMetaStore>(initialColumns);
  const [filteredColumns, setFilteredColumns] = useState<FieldNameMetaStore | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const { setSelectedColumns } = useScenesTableContext();

  //@todo fix
  const handleSetColumns = useCallback(
    (newColumns: FieldNameMetaStore) => {
      if (newColumns) {
        setColumns(newColumns);
        if (logsFrame) {
          updateUrlState(newColumns, logsFrame, setSelectedColumns);
        }
      }
    },
    [logsFrame, setSelectedColumns]
  );

  const handleSetVisible = useCallback((isVisible: boolean) => {
    setVisible(isVisible);
  }, []);

  // When the parent component recalculates new columns on dataframe change, we need to update or the column UI will be stale!
  useEffect(() => {
    if (initialColumns) {
      setColumns(initialColumns);
    }
  }, [initialColumns]);

  return (
    <TableColumnsContext.Provider
      value={{
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

function updateUrlState(
  pendingLabelState: FieldNameMetaStore,
  logsFrame: LogsFrame,
  setSelectedColumns: (cols: string[]) => void
) {
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
    // const defaultColumns = { 0: timeField?.name ?? '', 1: bodyField?.name ?? '' };
    const defaultColumns = [];
    if (timeField?.name) {
      defaultColumns.push(timeField.name);
    }
    if (bodyField?.name) {
      defaultColumns.push(bodyField.name);
    }

    const columns = Object.keys(newColumnsArray).length ? newColumnsArray : defaultColumns;

    // Update url state
    setSelectedColumns(columns);
  }
}

export const useTableColumnContext = () => {
  return useContext(TableColumnsContext);
};
