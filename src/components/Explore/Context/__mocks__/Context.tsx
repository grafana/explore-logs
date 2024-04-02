import React, { ReactNode } from 'react';

import { setDataSourceSrv } from '@grafana/runtime';

import { DataSourceContextProvider } from '../DataSourceContext';
import { LabelsContextProvider } from '../LabelsContext';
import { QueryContextProvider } from '../QueryContext';
import { TimeRangeContextProvider } from '../TimeRangeContext';

import { LokiDatasourceMock, mockInstanceSettings } from './LokiDataSource';

const mock = {
  getList: () => [
    {
      ...mockInstanceSettings,
      id: 1,
    },
    {
      ...mockInstanceSettings,
      id: 2,
      uid: 'loki-app-2',
      type: 'loki',
      name: 'Loki Data Source 2',
    },
  ],
  get: (uid: string) => {
    const settings = mock.getInstanceSettings(uid) || mockInstanceSettings;
    const dataSource = new LokiDatasourceMock({
      ...settings,
    });
    return Promise.resolve(dataSource);
  },
  getInstanceSettings: (ref: string) => {
    return mock.getList().find((settings) => settings.uid === ref);
  },
  reload: () => {},
};
//@ts-ignore
setDataSourceSrv(mock);

type Props = {
  children: ReactNode[] | ReactNode;
};

export const StoreContextWrapper = ({ children }: Props) => {
  return (
    <DataSourceContextProvider>
      <TimeRangeContextProvider>
        <QueryContextProvider>
          <LabelsContextProvider>{children}</LabelsContextProvider>
        </QueryContextProvider>
      </TimeRangeContextProvider>
    </DataSourceContextProvider>
  );
};
