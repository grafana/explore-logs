import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { DataFrame } from '@grafana/data';

import { useUrlParamsContext } from './UrlParamsContext';
import { FieldNameMetaStore } from '../Table/TableTypes';
import { TableUrlState } from '../Table/TableWrap';
import { useDataFrame } from '../hooks/useQuery';
import { DATAPLANE_BODY_NAME, DATAPLANE_TIMESTAMP_NAME } from '../services/logsFrame';

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
}: {
  children: ReactNode;
  initialColumns: FieldNameMetaStore;
}) => {
  const [columns, setColumns] = useState<FieldNameMetaStore>(initialColumns);
  const [filteredColumns, setFilteredColumns] = useState<FieldNameMetaStore | undefined>(undefined);
  const [visible, setVisible] = useState(false);
  const { setUrlParameter } = useUrlParamsContext();
  const dataFrame = useDataFrame();

  const handleSetColumns = useCallback(
    (newColumns: FieldNameMetaStore) => {
      setColumns(newColumns);
      if (dataFrame) {
        updateUrlState(newColumns, dataFrame, setUrlParameter);
      }
    },
    [dataFrame, setUrlParameter]
  );

  const handleSetVisible = useCallback((isVisible: boolean) => {
    setVisible(isVisible);
  }, []);

  // When the parent component recalculates new columns on dataframe change, we need to update or the column UI will be stale!
  useEffect(() => {
    setColumns(initialColumns);
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
  dataFrame: DataFrame,
  setUrlState: (key: string, value: TableUrlState) => void
) {
  if (!dataFrame) {
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

  const newColumns: Record<number, string> = Object.assign(
    {},
    // Get the keys of the object as an array
    newColumnsArray
  );

  const timeField = dataFrame.fields.find((f) => f.name === DATAPLANE_TIMESTAMP_NAME);
  const bodyField = dataFrame.fields.find((f) => f.name === DATAPLANE_BODY_NAME);

  if ((timeField && bodyField) || Object.keys(newColumns).length) {
    const defaultColumns = { 0: timeField?.name ?? '', 1: bodyField?.name ?? '' };

    const newPanelState: TableUrlState = {
      // URL format requires our array of values be an object, so we convert it using object.assign
      visibleColumns: Object.keys(newColumns).length ? newColumns : defaultColumns,
      labelFieldName: 'labels',
    };

    // Update url state
    setUrlState('table', newPanelState);
  }
}

export const useTableColumnContext = () => {
  return useContext(TableColumnsContext);
};
