import { LoadingState } from '@grafana/data';
import { sceneGraph } from '@grafana/scenes';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { of } from 'rxjs';
import { PatternNameLabel } from './PatternNameLabel';

const mockResult = {
  state: LoadingState.Done,
  data: [
    {
      fields: [
        {
          values: {
            toArray: () => [
              { field_1: 'value1', field_2: 'value2' },
              { field_1: 'value3', field_2: 'value4' },
            ],
          },
        },
      ],
    },
  ],
};

jest.mock('@grafana/scenes', () => {
  const actualScenes = jest.requireActual('@grafana/scenes'); // Require the actual module

  return {
    ...actualScenes,
    sceneGraph: {
      ...actualScenes.sceneGraph,
      getTimeRange: jest.fn().mockReturnValue({
        state: { value: { from: 'now-1h', to: 'now' } },
      }),
    },
  };
});

jest.mock('services/analytics', () => ({
  ...jest.requireActual('services/analytics'),
  reportAppInteraction: jest.fn(),
}));

const mockQuery = jest.fn().mockReturnValue(of([mockResult]));
const mockDatasource = { query: mockQuery };

jest.mock('services/scenes', () => ({
  ...jest.requireActual('services/scenes'),
  getLokiDatasource: jest.fn().mockImplementation(() => mockDatasource),
}));

jest.mock('services/variableGetters', () => ({
  ...jest.requireActual('services/variableGetters'),
  getLabelsVariable: jest.fn().mockReturnValue({ state: { filterExpression: 'foo="bar"' } }),
}));

const explorationMock = {} as any;

describe('PatternNameLabel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (sceneGraph.getTimeRange as jest.Mock).mockReturnValue({
      state: { value: { from: 'now-1h', to: 'now' } },
    });
  });

  it('calls data source query correctly', async () => {
    render(<PatternNameLabel exploration={explorationMock} pattern="test <_> pattern" maxLines={1000} />);

    const patternElement = screen.getByText('<_>');
    userEvent.click(patternElement);

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: [
            expect.objectContaining({
              expr: expect.stringContaining('{foo="bar"} |> `test <_> pattern` | pattern `test <field_1> pattern`'),
            }),
          ],
        })
      );
    });
  });

  it('calls datasource query', async () => {
    render(<PatternNameLabel exploration={explorationMock} pattern="test <_> pattern" maxLines={1000} />);

    const patternElement = screen.getByText('<_>');
    userEvent.click(patternElement);

    // Wait for the data fetching to complete
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  it('avoids duplicate queries for the same pattern and time range', async () => {
    render(<PatternNameLabel exploration={explorationMock} pattern="test <_> pattern" maxLines={1000} />);

    const patternElement = screen.getByText('<_>');
    userEvent.click(patternElement);

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    userEvent.click(patternElement);
    expect(mockQuery).toHaveBeenCalledTimes(1); // still 1 because no new query is fired
  });
});
