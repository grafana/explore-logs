import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { LineFilterScene } from './LineFilterScene';
import userEvent from '@testing-library/user-event';
import { AdHocFiltersVariable, SceneVariableSet } from '@grafana/scenes';
import { VAR_LINE_FILTER, VAR_LINE_FILTERS } from 'services/variables';
import { LineFilterCaseSensitive, LineFilterOp } from '../../../services/filterTypes';
import { renderLogQLLineFilter } from '../../../services/query';

let location = {} as Location;
jest.mock('lodash/debounce', () => (fn: { cancel: jest.Mock<any, any, any>; flush: jest.Mock<any, any, any> }) => {
  fn.cancel = jest.fn();
  fn.flush = jest.fn();
  return fn;
});
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
  let lineFilterVariable: AdHocFiltersVariable;
  let lineFiltersVariable: AdHocFiltersVariable;

  describe('case insensitive, no regex', () => {
    beforeEach(() => {
      lineFilterVariable = new AdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
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
      expect(scene.state.lineFilter).toEqual('some text');
      expect(scene.state.regex).toEqual(false);
      expect(scene.state.caseSensitive).toEqual(false);
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
      lineFilterVariable = new AdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
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
      expect(scene.state.lineFilter).toEqual('some text');
      expect(scene.state.regex).toEqual(false);
      expect(scene.state.caseSensitive).toEqual(true);
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
      lineFilterVariable = new AdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
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
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual(string);
      expect(scene.state.regex).toEqual(true);
      expect(scene.state.caseSensitive).toEqual(false);
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
      lineFilterVariable = new AdHocFiltersVariable({
        name: VAR_LINE_FILTER,
        expressionBuilder: renderLogQLLineFilter,
      });
      lineFiltersVariable = new AdHocFiltersVariable({
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
      await act(() => fireEvent.change(input, { target: { value: string } }));

      expect(await screen.findByDisplayValue(string)).toBeInTheDocument();
      expect(scene.state.lineFilter).toEqual(string);
      expect(scene.state.regex).toEqual(true);
      expect(scene.state.caseSensitive).toEqual(true);
    });

    test('Unescapes the regular expression from the variable value', async () => {
      const string = `((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}`;
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
});
