import { createDataFrame, FieldType, toDataFrame } from '@grafana/data';

import {
  extractParserAndFieldsFromDataFrame,
  getLabelTypeFromFrame,
  LabelType,
  updateParserFromDataFrame,
} from './fields';
import { getLogsFormatVariable, VAR_LOGS_FORMAT } from './variables';
import { CustomVariable, SceneObject } from '@grafana/scenes';
jest.mock('./variables');

describe('extractParserAndFieldsFromDataFrame', () => {
  it('Extracts parser and fields from a logfmt data frame', () => {
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

    expect(extractParserAndFieldsFromDataFrame(dataFrame)).toEqual({
      type: 'logfmt',
      fields: ['field2'],
    });
  });
  it('Extracts parser and fields from a json data frame', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Line',
          type: FieldType.string,
          values: ['{"jsonLabel": "jsonValue"}'],
        },
        { name: 'labelTypes', type: FieldType.other, values: [{ field1: 'I', field2: 'P', field3: 'S' }] },
      ],
    });

    expect(extractParserAndFieldsFromDataFrame(dataFrame)).toEqual({
      type: 'json',
      fields: ['field2'],
    });
  });
});

describe('updateParserFromDataFrame', () => {
  const logsFmtVariable = new CustomVariable({
    name: VAR_LOGS_FORMAT,
  });
  jest.mocked(getLogsFormatVariable).mockReturnValue(logsFmtVariable);

  it('should exclude mixed parser errors', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: 'Time', type: FieldType.time, values: [0] },
        {
          name: 'Line',
          type: FieldType.string,
          values: ['{"jsonLabel": "jsonValue"}', 'level=error myown=summer'],
        },
        { name: 'labelTypes', type: FieldType.other, values: [{ field1: 'I', field2: 'P', field3: 'S' }] },
      ],
    });
    const scene = {} as SceneObject;

    expect(updateParserFromDataFrame(dataFrame, scene)).toEqual({
      type: 'mixed',
      fields: ['field2'],
    });
    expect(logsFmtVariable.state.value).toEqual('| json  | logfmt | drop __error__, __error_details__');
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
