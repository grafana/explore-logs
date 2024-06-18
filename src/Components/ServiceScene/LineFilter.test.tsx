import React from 'react';
import { render, screen } from '@testing-library/react';
import { LineFilter } from './LineFilter';
import userEvent from '@testing-library/user-event';
import { CustomVariable, SceneVariableSet } from '@grafana/scenes';
import { VAR_LINE_FILTER } from 'services/variables';
import { VariableHide } from '@grafana/data';

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: unknown) => fn,
}));

describe('LineFilter', () => {
  let scene: LineFilter;
  let lineFilterVariable: CustomVariable;
  beforeEach(() => {
    lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
    scene = new LineFilter({
      $variables: new SceneVariableSet({
        variables: [lineFilterVariable],
      }),
    });
  });

  test('Updates the variable with the user input', async () => {
    render(<scene.Component model={scene} />);

    await userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text');

    expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
    expect(lineFilterVariable.getValue()).toBe('|~ `(?i)some text`');
  });

  test('Escapes the regular expression in the variable', async () => {
    render(<scene.Component model={scene} />);

    await userEvent.type(screen.getByPlaceholderText('Search in log lines'), '(characters');

    expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    expect(lineFilterVariable.getValue()).toBe('|~ `(?i)\\(characters`');
  });

  test('Unescapes the regular expression from the variable value', async () => {
    lineFilterVariable.changeValueTo('|~ `(?i)\\(characters`');

    render(<scene.Component model={scene} />);

    expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
  });
});
