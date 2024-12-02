import { SelectedTableRow } from 'Components/Table/LogLineCellComponent';
import {
  narrowFieldValue,
  narrowLogsVisualizationType,
  narrowRecordStringNumber,
  narrowSelectedTableRow,
  unknownToStrings,
} from './narrowing';
import { FieldValue, ParserType } from './variables';
import { LogsVisualizationType } from './store';

describe('unknownToStrings', () => {
  test.each([
    [undefined, []],
    [
      ['uno', 'dos', 3],
      ['uno', 'dos', ''],
    ],
    [
      [null, -1, NaN, Infinity, {}, Symbol('3')],
      ['', '', '', '', '', ''],
    ],
  ])('Processes unknown values and returns an array of strings', (input: unknown, output: string[]) => {
    expect(unknownToStrings(input)).toEqual(output);
  });
});

describe('narrowSelectedTableRow', () => {
  test.each([
    [undefined, false],
    [{}, false],
    [{ row: '1' }, false],
    [{ id: 1 }, false],
    [
      { row: 1, id: '1 ' },
      { row: 1, id: '1 ' },
    ],
  ])(
    'Processes unknown values and returns SelectedTableRow or false',
    (input: unknown, output: SelectedTableRow | boolean) => {
      expect(narrowSelectedTableRow(input)).toEqual(output);
    }
  );
});

describe('narrowLogsVisualizationType', () => {
  const logs: LogsVisualizationType = 'logs';
  const table: LogsVisualizationType = 'table';
  test.each([
    [undefined, false],
    ['taebl', false],
    [logs, logs],
    [table, table],
  ])(
    'Processes unknown values and returns an array of strings',
    (input: unknown, output: LogsVisualizationType | boolean) => {
      expect(narrowLogsVisualizationType(input)).toEqual(output);
    }
  );
});

describe('narrowFieldValue', () => {
  const parser: ParserType = 'json';
  test.each([
    [undefined, false],
    [{ parser: 1 }, false],
    [{ value: 1 }, false],
    [{ parser: 1, value: 1 }, false],
    [{ parser: 'json', value: 1 }, false],
    [
      { parser: 'json', value: 'value' },
      { parser, value: 'value' },
    ],
  ])('Processes unknown values and returns an array of strings', (input: unknown, output: FieldValue | boolean) => {
    expect(narrowFieldValue(input)).toEqual(output);
  });
});

describe('narrowRecordStringNumber', () => {
  test.each([
    [undefined, false],
    [{}, {}],
    [{ test: 'nope' }, {}],
    [{ injection: () => {} }, {}],
    [
      {
        get test() {
          return 1;
        },
      },
      { test: 1 },
    ],
    [
      {
        get test() {
          return '1';
        },
      },
      {},
    ],
    [{ test: 1 }, { test: 1 }],
  ])(
    'Processes unknown values and returns an array of strings',
    (input: unknown, output: Record<string, number> | boolean) => {
      expect(narrowRecordStringNumber(input)).toEqual(output);
    }
  );
});
