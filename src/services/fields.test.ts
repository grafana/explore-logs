import { createDataFrame, FieldType, toDataFrame } from '@grafana/data';

import { extractParserFromDetectedFields, getLabelTypeFromFrame, LabelType } from './fields';
import {
  DETECTED_FIELDS_CARDINALITY_NAME,
  DETECTED_FIELDS_NAME_FIELD,
  DETECTED_FIELDS_PARSER_NAME,
  DETECTED_FIELDS_TYPE_NAME,
} from './datasource';

jest.mock('./variables');

describe('extractParserFromDetectedFields', () => {
  it('Extracts parser and fields from a detected_field response with only structured metadata', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: [''],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('');
  });
  it('Extracts parser and fields from a detected_field response with only json', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['{"label": "10"}'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['json'],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('json');
  });
  it('Extracts parser and fields from a detected_field response with only logfmt ', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['pod-template-123abc'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['logfmt'],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('logfmt');
  });
  it('Extracts parser and fields from a detected_field response with only mixed ', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['pod-template-123abc'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: [['logfmt', 'json']],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('mixed');
  });
  it('Extracts parser and fields from a detected_field response with structured metadata and logfmt', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod', 'org'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10', '20'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['', 'logfmt'],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string', 'string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('logfmt');
  });
  it('Extracts parser and fields from a detected_field response with structured metadata, logfmt, and json', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod', 'org', 'greeting'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10', '20', '{"yo": "value"}'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['', 'logfmt', 'json'],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string', 'string', 'string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('mixed');
  });
  it('Extracts parser and fields from a detected_field response with structured metadata, and json', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod', 'org', 'greeting'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10', '{"id": "23"}', '{"yo": "value"}'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['', 'json', 'json'],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string', 'string', 'string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('json');
  });
  it('Extracts parser and fields from a detected_field response with structured metadata, json, and mixed', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod', 'org', 'greeting'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10', '{"id": "23"}', '{"yo": "value"}'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['', 'json', ['json', 'logfmt']],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string', 'string', 'string'],
        },
      ],
    });

    expect(extractParserFromDetectedFields(dataFrame)).toEqual('mixed');
  });
  it('Extracts parser and fields from a detected_field response with structured metadata, json, and json mixed with structured metadata', () => {
    const dataFrame = createDataFrame({
      refId: 'A',
      fields: [
        { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: ['pod', 'org', 'greeting'] },
        {
          name: DETECTED_FIELDS_CARDINALITY_NAME,
          type: FieldType.string,
          values: ['10', '{"id": "23"}', '{"yo": "value"}'],
        },
        {
          name: DETECTED_FIELDS_PARSER_NAME,
          type: FieldType.string,
          values: ['', 'json', ['json', '']],
        },
        {
          name: DETECTED_FIELDS_TYPE_NAME,
          type: FieldType.string,
          values: ['string', 'string', 'string'],
        },
      ],
    });

    //@todo can a field with multiple parsers have structured metadata and json or logfmt? This returns mixed right now, but should probably be json if this can happen?
    expect(extractParserFromDetectedFields(dataFrame)).toEqual('mixed');
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
