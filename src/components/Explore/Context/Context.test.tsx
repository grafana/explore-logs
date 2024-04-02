import { renderHook, waitFor } from '@testing-library/react';

import { LokiDatasourceMock, mockInstanceSettings } from './__mocks__/LokiDataSource';
import { StoreContextWrapper } from './Context';
import { useDataSourceContext } from './DataSourceContext';
import { useTimeRangeContext } from './TimeRangeContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    const mock = {
      getList: () => [
        {
          ...mockInstanceSettings,
        },
      ],
      get: (uid: string) => {
        const dataSource = new LokiDatasourceMock({
          ...mockInstanceSettings,
          uid,
        });
        return Promise.resolve(dataSource);
      },
      getInstanceSettings: () => undefined,
      reload: () => {},
    };
    return mock;
  },
}));

describe('StoreContextWrapper', () => {
  test('Provides the time range context', async () => {
    const { result } = renderHook(() => useTimeRangeContext(), { wrapper: StoreContextWrapper });

    await waitFor(() => {
      expect(result.current.timeRange).toBeDefined();
      expect(result.current.setTimeRange).toBeDefined();
    });
  });

  test('Provides the data source context', async () => {
    const { result } = renderHook(() => useDataSourceContext(), { wrapper: StoreContextWrapper });

    await waitFor(() => {
      expect(result.current.dataSource).toBeDefined();
      expect(result.current.noDataSources).toBeFalsy();
      expect(result.current.setDataSource).toBeDefined();
    });
  });
});
