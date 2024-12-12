import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LineFilterScene } from './LineFilterScene';
import userEvent from '@testing-library/user-event';
import { CustomVariable, SceneVariableSet } from '@grafana/scenes';
import { VAR_LINE_FILTER } from 'services/variables';
import { VariableHide } from '@grafana/data';

jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: unknown) => fn,
}));

describe('LineFilter', () => {
  let scene: LineFilterScene;
  let lineFilterVariable: CustomVariable;

  describe('case insensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
      scene = new LineFilterScene({
        caseSensitive: false,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|~ `(?i)some text`');
    });

    test('Escapes the regular expression in the variable', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), '(characters'));

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|~ `(?i)\\(characters`');
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.changeValueTo('|~ `(?i)\\(characters`');

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case sensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
      scene = new LineFilterScene({
        caseSensitive: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|= `some text`');
    });

    test('Escapes the regular expression in the variable', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), '(characters'));

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|= `\\(characters`');
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.changeValueTo('|~ `(?i)\\(characters`');

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case insensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
      scene = new LineFilterScene({
        caseSensitive: false,
        regex: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      // Jest can't type regex apparently
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe(`|~ \`(?i)${string}\``);
    });

    test('Does not escape the regular expression', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      // Jest can't type regex apparently
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe(`|~ \`(?i)${string}\``);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      lineFilterVariable.changeValueTo(`|~ \`(?i)${string}\``);

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
  describe('case sensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
      scene = new LineFilterScene({
        caseSensitive: true,
        regex: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      // Jest can't type regex apparently
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe(`|~ \`${string}\``);
    });

    test('Does not escape the regular expression', async () => {
      render(<scene.Component model={scene} />);

      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      const input = screen.getByPlaceholderText('Search in log lines');
      // Jest can't type regex apparently
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe(`|~ \`${string}\``);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
      lineFilterVariable.changeValueTo(`|~ \`${string}\``);

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
});
