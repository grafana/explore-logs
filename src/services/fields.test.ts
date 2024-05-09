import { FieldType, createDataFrame } from '@grafana/data';

import { extractParserAndFieldsFromDataFrame } from './fields';

describe('extractParserAndFieldsFromDataFrame', () => {
  const dataFrame = createDataFrame({
    refId: 'A',
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1'],
      },
      { name: 'labelTypes', type: FieldType.other, values: [{ field1: 'I', field2: 'P', field3: 'S' }] },
    ],
  });

  test('Extracts parser and fields from a data frame', () => {
    expect(extractParserAndFieldsFromDataFrame(dataFrame)).toEqual({
      type: 'logfmt',
      fields: ['field2'],
    });
  });
});
