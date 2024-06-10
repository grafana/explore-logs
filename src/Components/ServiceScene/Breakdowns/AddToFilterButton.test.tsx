import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AddToFiltersButton } from './AddToFiltersButton';
import { FieldType, createDataFrame } from '@grafana/data';
import userEvent from '@testing-library/user-event';
import { sceneGraph } from '@grafana/scenes';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS } from 'services/variables';

describe('AddToFiltersButton', () => {
  it('updates correct variable passed to AddToFiltersButton', async () => {
    const button = new AddToFiltersButton({
      frame: createDataFrame({
        name: 'frame1',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [0],
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [100],
            labels: {
              test: 'error',
            },
          },
        ],
      }),
      variableName: 'testVariableName',
    });
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable');
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Add to filters' }));
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith('testVariableName', expect.anything()));
  });

  it('updates correct variable when LEVEL_VARIABLE_VALUE', async () => {
    const labels: { [key: string]: string } = {};
    labels[LEVEL_VARIABLE_VALUE] = 'error';
    const button = new AddToFiltersButton({
      frame: createDataFrame({
        name: 'frame2',
        fields: [
          {
            name: 'time',
            type: FieldType.time,
            values: [0],
          },
          {
            name: 'value',
            type: FieldType.number,
            values: [100],
            labels,
          },
        ],
      }),
      variableName: 'testVariableName',
    });
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable');
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Add to filters' }));
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith(VAR_FIELDS, expect.anything()));
  });
});
