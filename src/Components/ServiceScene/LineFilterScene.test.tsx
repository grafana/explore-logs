import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LineFilterCaseSensitive, LineFilterScene } from './LineFilterScene';
import userEvent from '@testing-library/user-event';
import { SceneVariableSet } from '@grafana/scenes';
import { VAR_LINE_FILTER, VAR_LINE_FILTERS } from 'services/variables';
import { LineFilterOp } from '../../services/filterTypes';
import { renderLogQLLineFilter } from '../../services/query';
import { CustomAdHocFiltersVariable } from '../../services/CustomAdHocFiltersVariable';

let location = {} as Location;
jest.mock('lodash', () => ({
  ...jest.requireActual('lodash'),
  debounce: (fn: unknown) => fn,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  locationService: {
    getSearch: () => new URLSearchParams(location.search),
    getLocation: () => location,
    replace: jest.fn(),
  },
}));

describe('LineFilter', () => {
  let scene: LineFilterScene;
  let lineFilterVariable: CustomAdHocFiltersVariable;
  let lineFiltersVariable: CustomAdHocFiltersVariable;

  describe('case insensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTERS,
        expressionBuilder: renderLogQLLineFilter,
      });
      scene = new LineFilterScene({
        caseSensitive: false,
        regex: false,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);
      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(lineFilterVariable.state.filters).toEqual([
        {
          keyLabel: '0',
          key: LineFilterCaseSensitive.caseInsensitive,
          operator: LineFilterOp.match,
          value: 'some text',
        },
      ]);
      expect(lineFilterVariable.getValue()).toBe('|~ `(?i)some text`');
    });

    test('Escapes the regular expression in the variable', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), '(characters'));

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|~ `(?i)\\(characters`');
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseInsensitive,
            operator: LineFilterOp.match,
            value: '(characters',
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case sensitive, no regex', () => {
    beforeEach(() => {
      // lineFilterVariable = new CustomVariable({ name: VAR_LINE_FILTER, value: '', hide: VariableHide.hideVariable });
      lineFilterVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTERS,
        expressionBuilder: renderLogQLLineFilter,
      });
      scene = new LineFilterScene({
        caseSensitive: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
      });
    });

    test('Updates the variable with the user input', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), 'some text'));

      expect(await screen.findByDisplayValue('some text')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|= `some text`');
    });

    test('Does not escape user input', async () => {
      render(<scene.Component model={scene} />);

      await act(() => userEvent.type(screen.getByPlaceholderText('Search in log lines'), '.(characters'));

      expect(await screen.findByDisplayValue('.(characters')).toBeInTheDocument();
      expect(lineFilterVariable.getValue()).toBe('|= `.(characters`');
    });

    test('Unescapes the regular expression from the variable value', async () => {
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            operator: LineFilterOp.match,
            value: '(characters',
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue('(characters')).toBeInTheDocument();
    });
  });
  describe('case insensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTERS,
        expressionBuilder: renderLogQLLineFilter,
      });
      scene = new LineFilterScene({
        caseSensitive: false,
        regex: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
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
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseInsensitive,
            operator: LineFilterOp.regex,
            value: string,
          },
        ],
      });
      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
  describe('case sensitive, regex', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTERS,
        expressionBuilder: renderLogQLLineFilter,
      });
      scene = new LineFilterScene({
        caseSensitive: true,
        regex: true,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
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
      // lineFilterVariable.changeValueTo(`|~ \`${string}\``);
      lineFilterVariable.setState({
        filters: [
          {
            key: LineFilterCaseSensitive.caseSensitive,
            operator: LineFilterOp.regex,
            value: string,
          },
        ],
      });

      render(<scene.Component model={scene} />);

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
    });
  });
  describe('should migrate old urls', () => {
    beforeEach(() => {
      lineFilterVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new CustomAdHocFiltersVariable({
        name: VAR_LINE_FILTERS,
        expressionBuilder: renderLogQLLineFilter,
      });
      scene = new LineFilterScene({
        caseSensitive: false,
        regex: false,
        $variables: new SceneVariableSet({
          variables: [lineFilterVariable, lineFiltersVariable],
        }),
      });
    });
    test('it should populate input from case sensitive filter', async () => {
      location.search = '?param=value&var-lineFilter=|= `bodySize`';

      render(<scene.Component model={scene} />);
      // Current case button state should be case-sensitive
      expect(await screen.getByLabelText('Disable case match')).toBeInTheDocument();
      // Current regex button state should be string matching
      expect(await screen.getByLabelText('Enable regex')).toBeInTheDocument();
      expect(await screen.findByDisplayValue('bodySize')).toBeInTheDocument();
    });

    test('it should populate input from case insensitive filter', async () => {
      location.search = '?param=value&var-lineFilter=|~ `(?i)post`';

      render(<scene.Component model={scene} />);
      // Current case button state should be case-insensitive
      expect(await screen.getByLabelText('Enable case match')).toBeInTheDocument();
      // Current regex button state should be string matching
      expect(await screen.getByLabelText('Enable regex')).toBeInTheDocument();
      expect(await screen.findByDisplayValue('post')).toBeInTheDocument();
      expect(await screen.queryByDisplayValue('(?i)post')).not.toBeInTheDocument();
    });
  });
});
