import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { getDataSourceSrv } from '@grafana/runtime';

import { useUrlParameter } from '@/hooks/useUrlParameter';
import { isLokiDatasource } from '@/services/datasource';
import { LokiDatasource } from '@/services/lokiTypes';
import { UrlParameterType } from '@/services/routing';

export type DataSourceContextType = {
  dataSource: LokiDatasource | undefined;
  noDataSources: boolean;
  setDataSource(uid: string): void;
};

export const initialState = {
  dataSource: undefined,
  noDataSources: false,
  setDataSource: (uid: string) => {},
};

export const DataSourceContext = createContext<DataSourceContextType>(initialState);

export const DataSourceContextProvider = ({ children }: { children: ReactNode }) => {
  const [dataSource, setDataSource] = useState<LokiDatasource | undefined>(undefined);
  const [noDataSources, setNoDataSources] = useState(false);
  const [dsUid, setDsUid] = useUrlParameter<string>(UrlParameterType.DatasourceId);

  const handleSetDataSource = useCallback(
    (uid: string) => {
      getDataSourceSrv()
        .get(uid)
        .then((ds) => {
          if (isLokiDatasource(ds)) {
            setDsUid(uid);
            setDataSource(ds as unknown as LokiDatasource);
          }
        })
        .catch((error) => {
          console.error(error);
          setNoDataSources(true);
        });
    },
    [setDsUid]
  );

  useEffect(() => {
    if (dsUid) {
      // dsUid from query param
      handleSetDataSource(dsUid);
      return;
    }

    const ds = getDataSourceSrv()
      .getList()
      .find((ds) => ds.type === 'loki');
    if (!ds) {
      setNoDataSources(true);
      return;
    }
    handleSetDataSource(ds.uid);
  }, [dsUid, handleSetDataSource]);

  return (
    <DataSourceContext.Provider value={{ dataSource, noDataSources, setDataSource: handleSetDataSource }}>
      {children}
    </DataSourceContext.Provider>
  );
};

export const useDataSourceContext = () => {
  return useContext(DataSourceContext);
};
