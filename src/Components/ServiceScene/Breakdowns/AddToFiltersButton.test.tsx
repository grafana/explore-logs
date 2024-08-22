import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { addAdHocFilter, addToFilters, AddToFiltersButton, FilterType } from './AddToFiltersButton';
import { BusEvent, createDataFrame, Field, FieldType, LoadingState, PanelData } from '@grafana/data';
import userEvent from '@testing-library/user-event';
import { AdHocFiltersVariable, sceneGraph, SceneObject, SceneQueryRunner } from '@grafana/scenes';
import { LEVEL_VARIABLE_VALUE, VAR_FIELDS, VAR_LABELS, VAR_LEVELS } from 'services/variables';
import { ServiceSceneState } from '../ServiceScene';

const scene = { publishEvent(event: BusEvent, bubble?: boolean) {} } as SceneObject;

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
    await waitFor(async () => expect(lookup).toHaveBeenCalledWith(VAR_LEVELS, expect.anything()));
  });
});

describe('addToFilters and addAdHocFilter', () => {
  let adHocVariable: AdHocFiltersVariable;
  beforeEach(() => {
    const labels = [
      {
        label: 'indexed',
        cardinality: 1,
      },
    ];
    const detectedLabelFields: Array<Partial<Field>> = labels?.map((label) => {
      return {
        name: label.label,
        values: [label.cardinality],
      };
    });
    const dataFrame = createDataFrame({
      refId: 'detected_labels',
      fields: detectedLabelFields ?? [],
    });
    const panelData: Partial<PanelData> = {
      state: LoadingState.Done,
      series: [dataFrame],
    };
    const state: Partial<ServiceSceneState> = {
      $detectedLabelsData: {
        state: {
          data: panelData,
          queries: [],
        },
      } as unknown as SceneQueryRunner,
    };

    jest.spyOn(sceneGraph, 'getAncestor').mockReturnValue({
      state: state,
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
      addToFilters('key', 'value', type as FilterType, scene);

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
      addToFilters('existing', 'existingValue', 'toggle', scene);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to clear a filter', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('existing', 'existingValue', 'clear', scene);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_FIELDS, expect.anything());
      expect(adHocVariable.state.filters).toEqual([]);
    });

    it('allows to specify the variable to write to', () => {
      const variableName = 'myVariable';
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('key', 'value', 'include', scene, variableName);

      expect(lookupVariable).toHaveBeenCalledWith(variableName, expect.anything());
    });

    it('identifies indexed labels and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addToFilters('indexed', 'value', 'include', scene);

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
      addToFilters(LEVEL_VARIABLE_VALUE, 'info', 'include', scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LABELS, expect.anything());
    });
  });

  describe('addAdHocFilter', () => {
    it.each(['=', '!='])('allows to add an %s filter', (operator: string) => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: 'key', value: 'value', operator }, scene);

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
      addAdHocFilter({ key: 'key', value: 'value', operator: '=' }, scene, variableName);

      expect(lookupVariable).toHaveBeenCalledWith(variableName, expect.anything());
    });

    it('identifies indexed labels and uses the appropriate variable', () => {
      const lookupVariable = jest.spyOn(sceneGraph, 'lookupVariable').mockReturnValue(adHocVariable);
      addAdHocFilter({ key: 'indexed', value: 'value', operator: '=' }, scene);

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
      addAdHocFilter({ key: LEVEL_VARIABLE_VALUE, value: 'info', operator: '=' }, scene, VAR_FIELDS);

      expect(lookupVariable).toHaveBeenCalledWith(VAR_LEVELS, expect.anything());
    });
  });
});
