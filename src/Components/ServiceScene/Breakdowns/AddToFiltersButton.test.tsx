import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AddToFiltersButton, FilterType, addAdHocFilter, addToFilters } from './AddToFiltersButton';
import { FieldType, createDataFrame } from '@grafana/data';
import userEvent from '@testing-library/user-event';
import { AdHocFiltersVariable, SceneObject, sceneGraph } from '@grafana/scenes';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS } from 'services/variables';

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
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(new AdHocFiltersVariable({}));
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Include' }));
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
    const lookup = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(new AdHocFiltersVariable({}));
    render(<button.Component model={button} />);
    userEvent.click(screen.getByRole('button', { name: 'Include' }));
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith(VAR_FIELDS, expect.anything()));
  });
});

describe('addToFilters and addAdHocFilter', () => {
  let adHocVariable: AdHocFiltersVariable;
  beforeEach(() => {
    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: {
        labels: ['indexed'],
      },
    });
    adHocVariable = new AdHocFiltersVariable({
      filters: [
        {
          key: 'existing',
          operator: '=',
          value: 'existingValue',
        },
      ],
    });
  });

  describe('addToFilters', () => {
    it.each(['include', 'exclude'])('allows to add an %s filter', (type: string) => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('key', 'value', type as FilterType, {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: 'existingValue',
        },
        {
          key: 'key',
          operator: type === 'include' ? '=' : '!=',
          value: 'value',
        },
      ]);
    });

    it('allows to toggle a filter', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('existing', 'existingValue', 'toggle', {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to clear a filter', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('existing', 'existingValue', 'clear', {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to specify the variable to write to', () => {
      const variableName = 'myVariable';
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('key', 'value', 'include', {} as SceneObject, variableName);

      expect(lookupVariable).toHaveBeenCalledWith(variableName, expect.anything());
    });

    it('identifies indexed lables and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('indexed', 'value', 'include', {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: 'existingValue',
        },
        {
          key: 'indexed',
          operator: '=',
          value: 'value',
        },
      ]);
    });

    it(`uses the correct name when filtering for ${LEVEL_VARIABLE_VALUE}`, () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters(LEVEL_VARIABLE_VALUE, 'info', 'include', {} as SceneObject, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
    });
  });

  describe('addAdHocFilter', () => {
    it.each(['=', '!='])('allows to add an %s filter', (operator: string) => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: 'key', value: 'value', operator }, {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: 'existingValue',
        },
        {
          key: 'key',
          operator,
          value: 'value',
        },
      ]);
    });

    it('allows to specify the variable to write to', () => {
      const variableName = 'myVariable';
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: 'key', value: 'value', operator: '=' }, {} as SceneObject, variableName);

      expect(lookupVariable).toHaveBeenCalledWith(variableName, expect.anything());
    });

    it('identifies indexed lables and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: 'indexed', value: 'value', operator: '=' }, {} as SceneObject);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([
        {
          key: 'existing',
          operator: '=',
          value: 'existingValue',
        },
        {
          key: 'indexed',
          operator: '=',
          value: 'value',
        },
      ]);
    });

    it(`uses the correct name when filtering for ${LEVEL_VARIABLE_VALUE}`, () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: LEVEL_VARIABLE_VALUE, value: 'info', operator: '=' }, {} as SceneObject, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
    });
  });
});
