import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

export type CellIndex = {
  fieldName?: string;
  // If the field contains labels (like log line), we need to know which field (line) and which label (e.g. level)
  subFieldName?: string;
  index: number | null;
  numberOfMenuItems?: number;
};

type TableCellContextType = {
  cellIndex: CellIndex;
  setActiveCellIndex(cellIndex: CellIndex): void;
};

const TableCellContext = createContext<TableCellContextType>({
  cellIndex: { index: null, numberOfMenuItems: 3 },
  setActiveCellIndex: (cellIndex: CellIndex) => false,
});

export const TableCellContextProvider = ({ children }: { children: ReactNode }) => {
  const [cellActive, setCellActive] = useState<CellIndex>({ index: null });

  const handleCellActive = useCallback((cellIndex: CellIndex) => {
    setCellActive(cellIndex);
  }, []);

  return (
    <TableCellContext.Provider value={{ cellIndex: cellActive, setActiveCellIndex: handleCellActive }}>
      {children}
    </TableCellContext.Provider>
  );
};

export const useTableCellContext = () => {
  return useContext(TableCellContext);
};
