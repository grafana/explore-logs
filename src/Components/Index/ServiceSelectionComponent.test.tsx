import React from 'react';
import { render, waitFor } from '@testing-library/react';
import {
  ServiceSelectionComponent,
  ServiceSelectionComponentState,
  createListOfServicesToQuery,
} from './ServiceSelectionComponent';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
  }),
}));

jest.mock('services/scenes', () => ({
  getLokiDatasource: jest.fn().mockResolvedValue({
    getResource: jest.fn().mockResolvedValue({
      data: {
        result: [
          { metric: { service_name: 'service1' }, value: [1, 100] },
          { metric: { service_name: 'service2' }, value: [1, 200] },
          { metric: { service_name: 'service3' }, value: [1, 300] },
        ],
      },
    }),
  }),
}));

describe('ServiceSelectionComponent', () => {
  it('should render the correct number of services', async () => {
    const servicesByVolume = ['service1', 'service2', 'service3'];
    const favoriteServices = ['service2'];

    const state: Partial<ServiceSelectionComponentState> = {
      isServicesByVolumeLoading: false,
      servicesByVolume,
      searchServicesString: '',
      servicesToQuery: createListOfServicesToQuery(servicesByVolume, favoriteServices),
    };

    const { getAllByTestId } = render(
      <ServiceSelectionComponent.Component model={new ServiceSelectionComponent(state)} />
    );

    await waitFor(() => expect(getAllByTestId('timeseries-panel')).toHaveLength(3));
  });
});
