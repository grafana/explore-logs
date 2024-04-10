import { act, renderHook, waitFor } from '@testing-library/react';

import { LokiDatasourceMock, mockInstanceSettings } from './__mocks__/LokiDataSource';
import { DataSourceContextProvider, useDataSourceContext } from './DataSourceContext';

let returnEmptyList = false;
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    const mock = {
      getList: () => {
        if (returnEmptyList) {
          return [];
        }
        return [
          {
            ...mockInstanceSettings,
          },
        ];
      },
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

describe('DataSourceContext', () => {
  test('Provides a data source instance', async () => {
    const { result } = renderHook(() => useDataSourceContext(), { wrapper: DataSourceContextProvider });

    await waitFor(() => {
      expect(result.current.dataSource).toBeDefined();
      expect(result.current.noDataSources).toBeFalsy();
      expect(result.current.setDataSource).toBeDefined();
    });
  });

  test('Allows to change the current data source instance', async () => {
    const { result } = renderHook(() => useDataSourceContext(), { wrapper: DataSourceContextProvider });

    await waitFor(() => {
      expect(result.current.dataSource?.uid).not.toBe('test');
    });
    act(() => {
      result.current.setDataSource('test');
    });
    await waitFor(() => {
      expect(result.current.dataSource?.uid).toBe('test');
    });
  });

  test('Sets a flag when there are no Loki data sources', async () => {
    returnEmptyList = true;
    const { result } = renderHook(() => useDataSourceContext(), { wrapper: DataSourceContextProvider });

    await waitFor(() => {
      expect(result.current.dataSource).toBe(undefined);
      expect(result.current.noDataSources).toBe(true);
      expect(result.current.setDataSource).toBeDefined();
    });
    returnEmptyList = false;
  });
});
