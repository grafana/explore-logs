import { AdHocVariableFilter } from '@grafana/data';
import {
  buildDataQuery,
  joinTagFilters,
  renderLogQLFieldFilters,
  renderLogQLLabelFilters,
  renderLogQLLineFilter,
} from './query';

import { FieldValue } from './variables';
import { AdHocFiltersVariable } from '@grafana/scenes';
import { FilterOp, LineFilterCaseSensitive, LineFilterOp } from './filterTypes';

describe('buildDataQuery', () => {
  test('Given an expression outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}')).toEqual({
      editorMode: 'code',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'A',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });

  test('Given an expression and overrides outputs a Loki query', () => {
    expect(buildDataQuery('{place="luna"}', { editorMode: 'gpt', refId: 'C' })).toEqual({
      editorMode: 'gpt',
      expr: '{place="luna"}',
      queryType: 'range',
      refId: 'C',
      supportingQueryType: 'grafana-lokiexplore-app',
    });
  });
});

describe('renderLogQLFieldFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level=`info` | cluster=`lil-cluster`');
  });

  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level!=`info` | cluster!=`lil-cluster`');
  });

  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'error',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual('| level=`info` or level=`error`');
  });

  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'info',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'comp1',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'error',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: JSON.stringify({
          value: 'lil-cluster',
          parser: 'logfmt',
        } as FieldValue),
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: JSON.stringify({
          value: 'pod1',
          parser: 'logfmt',
        } as FieldValue),
      },
    ];

    expect(renderLogQLFieldFilters(filters)).toEqual(
      '| level=`info` or level=`error` | cluster=`lil-cluster` | component!=`comp1` | pod!=`pod1`'
    );
  });
});
describe('renderLogQLLineFilter not containing backticks', () => {
  // REGEXP ops
  test('Renders positive case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i).(search"');
  });
  test('Renders positive case-insensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: '\nThe "key" field',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\nThe \\"key\\" field"');
  });
  test('Renders positive case-sensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.regex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "\\\\w+"');
  });
  test('Renders negative case-sensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.negativeRegex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "\\\\w+"');
  });
  test('Renders negative case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.negativeRegex,
        value: '\\w+',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "(?i)\\\\w+"');
  });

  // String contains ops
  test('Renders positive case-insensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.match,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\\\.\\\\(search"');
  });
  test('Renders positive case-sensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.match,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('|= ".(search"');
  });
  test('Renders negative case-insensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.negativeMatch,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!~ "(?i)\\\\.\\\\(search"');
  });
  test('Renders negative case-sensitive string compare', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.negativeMatch,
        value: '.(search',
      },
    ];

    expect(renderLogQLLineFilter(filters)).toEqual('!= ".(search"');
  });
});
describe('renderLogQLLineFilter containing backticks', () => {
  // Keep in mind we see twice as many escape chars in the test code as we do IRL
  test('Renders positive case-insensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        // If a log line contains a newline as a string, they will need to escape the escape char and type "\\n" in the field input, otherwise loki will match actual newlines with regex searches
        value: '\\\\nThe `key` field', // the user enters: \\nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|~ "(?i)\\\\\\\\nThe `key` field"');
  });
  test('Renders positive case-sensitive regex with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.regex,
        value: '\\\\nThe `key` field', // the user enters: \\nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|~ "\\\\\\\\nThe `key` field"');
  });
  test('Renders positive case-insensitive match with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.match,
        value: '\\nThe `key` field', // the user enters: \nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual(`|~ "(?i)\\\\\\\\nThe \`key\` field"`);
  });
  test('Renders positive case-sensitive match with newline', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseSensitive,
        operator: LineFilterOp.match,
        value: '\\nThe `key` field', // the user enters: \nThe `key` field
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual('|= "\\\\nThe `key` field"');
  });
  test('Renders positive case-insensitive regex', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: LineFilterCaseSensitive.caseInsensitive,
        operator: LineFilterOp.regex,
        value: `^level=[error|warning].+((25[0-5]|(2[0-4]|1\\d|[1-9]|)\\d)\\.?\\b){4}:\\d{5}"$|\``, // the user enters ^level=[error|warning].+((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}:\d{5}"$|`
      },
    ];
    expect(renderLogQLLineFilter(filters)).toEqual(
      '|~ "(?i)^level=[error|warning].+((25[0-5]|(2[0-4]|1\\\\d|[1-9]|)\\\\d)\\\\.?\\\\b){4}:\\\\d{5}\\"$|`"'
    );
  });
});
describe('renderLogQLLabelFilters', () => {
  test('Renders positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level=`info`, cluster=`lil-cluster`');
  });

  test('Renders negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.NotEqual,
        value: 'info',
      },
      {
        key: 'cluster',
        operator: FilterOp.NotEqual,
        value: 'lil-cluster',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level!=`info`, cluster!=`lil-cluster`');
  });

  test('Groups positive filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual('level=~"info|error"');
  });

  test('Renders grouped and ungrouped positive and negative filters', () => {
    const filters: AdHocVariableFilter[] = [
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'info',
      },
      {
        key: 'component',
        operator: FilterOp.NotEqual,
        value: 'comp1',
      },
      {
        key: 'level',
        operator: FilterOp.Equal,
        value: 'error',
      },
      {
        key: 'cluster',
        operator: FilterOp.Equal,
        value: 'lil-cluster',
      },
      {
        key: 'pod',
        operator: FilterOp.NotEqual,
        value: 'pod1',
      },
    ];

    expect(renderLogQLLabelFilters(filters)).toEqual(
      'level=~"info|error", cluster=`lil-cluster`, component!=`comp1`, pod!=`pod1`'
    );
  });
});

describe('joinTagFilters', () => {
  it('joins multiple include', () => {
    const adHoc = new AdHocFiltersVariable({
      filters: [
        {
          key: 'service_name',
          value: 'service_value',
          operator: '=',
        },
        {
          key: 'service_name',
          value: 'service_value_2',
          operator: '=',
        },
        {
          key: 'not_service_name',
          value: 'not_service_name_value',
          operator: '=',
        },
      ],
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'service_name',
        value: 'service_value|service_value_2',
        operator: '=~',
      },
      {
        key: 'not_service_name',
        value: 'not_service_name_value',
        operator: '=',
      },
    ]);
  });
  it('joins multiple exclude', () => {
    const filters = [
      {
        key: 'not_service_name',
        value: 'not_service_name_value',
        operator: '=',
      },
      {
        key: 'service_name',
        value: 'service_value',
        operator: '!=',
      },
      {
        key: 'service_name',
        value: 'service_value_2',
        operator: '!=',
      },
    ];

    const adHoc = new AdHocFiltersVariable({
      filters,
    });

    const result = joinTagFilters(adHoc);
    expect(result).toEqual([
      {
        key: 'not_service_name',
        value: 'not_service_name_value',
        operator: '=',
      },
      {
        key: 'service_name',
        value: 'service_value|service_value_2',
        operator: '!~',
      },
    ]);
  });
});
