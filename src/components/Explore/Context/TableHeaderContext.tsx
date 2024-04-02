import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type TableHeaderContextType = {
  isHeaderMenuActive: boolean;
  setHeaderMenuActive: (isHeaderMenuActive: boolean) => void;
};

const TableHeaderContext = createContext<TableHeaderContextType>({
  isHeaderMenuActive: false,
  setHeaderMenuActive: (isHeaderMenuActive: boolean) => false,
});

export const TableHeaderContextProvider = ({ children }: { children: ReactNode }) => {
  const [isHeaderMenuActive, setHeaderMenuActive] = useState<boolean>(false);

  const handleisHeaderMenuActive = useCallback((isHeaderMenuActive: boolean) => {
    setHeaderMenuActive(isHeaderMenuActive);
  }, []);

  return (
    <TableHeaderContext.Provider value={{ isHeaderMenuActive, setHeaderMenuActive: handleisHeaderMenuActive }}>
      {children}
    </TableHeaderContext.Provider>
  );
};

export const useTableHeaderContext = () => {
  return useContext(TableHeaderContext);
};
