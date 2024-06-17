import { FieldType, createDataFrame, toDataFrame } from '@grafana/data';

import { LabelType, extractParserAndFieldsFromDataFrame, getLabelTypeFromFrame } from './fields';

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

describe('getLabelTypeFromFrame', () => {
  const frameWithTypes = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1'],
      },
      { name: 'labelTypes', type: FieldType.other, values: [{ indexed: 'I', parsed: 'P', structured: 'S' }] },
    ],
  });
  const frameWithoutTypes = toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: [0] },
      {
        name: 'Line',
        type: FieldType.string,
        values: ['line1'],
      },
      { name: 'labels', type: FieldType.other, values: [{ job: 'test' }] },
    ],
  });
  it('returns structuredMetadata', () => {
    expect(getLabelTypeFromFrame('structured', frameWithTypes)).toBe(LabelType.StructuredMetadata);
  });
  it('returns indexed', () => {
    expect(getLabelTypeFromFrame('indexed', frameWithTypes)).toBe(LabelType.Indexed);
  });
  it('returns parsed', () => {
    expect(getLabelTypeFromFrame('parsed', frameWithTypes)).toBe(LabelType.Parsed);
  });
  it('returns null for unknown field', () => {
    expect(getLabelTypeFromFrame('unknown', frameWithTypes)).toBe(null);
  });
  it('returns null for frame without types', () => {
    expect(getLabelTypeFromFrame('job', frameWithoutTypes)).toBe(null);
  });
});
