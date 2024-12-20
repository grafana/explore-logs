import { AdHocFiltersVariable } from '@grafana/scenes';
import { VAR_FIELDS, VAR_METADATA } from '../../../services/variables';
import { createDataFrame, DataFrame, Field, FieldType } from '@grafana/data';
import {
  DETECTED_FIELDS_CARDINALITY_NAME,
  DETECTED_FIELDS_NAME_FIELD,
  DETECTED_FIELDS_PARSER_NAME,
  DETECTED_FIELDS_TYPE_NAME,
} from '../../../services/datasource';
import { buildFieldsQueryString } from '../../../services/fields';

describe('buildFieldsQueryString', () => {
  test('should build logfmt-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [],
    });

    const nameField: Field = {
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
      config: {},
    };
    const cardinalityField: Field = {
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
      config: {},
    };
    const parserField: Field = {
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['logfmt'],
      config: {},
    };
    const typeField: Field = {
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
      config: {},
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | logfmt | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build json-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [],
    });

    const nameField: Field = {
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
      config: {},
    };
    const cardinalityField: Field = {
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
      config: {},
    };
    const parserField: Field = {
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['json'],
      config: {},
    };
    const typeField: Field = {
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
      config: {},
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | json | drop __error__, __error_details__ | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build mixed-parser query', () => {
    const filterVariable = new AdHocFiltersVariable({
      name: VAR_FIELDS,
      filters: [],
    });
    const nameField: Field = {
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
      config: {},
    };
    const cardinalityField: Field = {
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
      config: {},
    };
    const parserField: Field = {
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: ['logfmt, json'],
      config: {},
    };
    const typeField: Field = {
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
      config: {},
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', filterVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}}  \${levels} \${metadata} \${patterns} \${lineFilters} | json | logfmt | drop __error__, __error_details__ | caller!="" \${fields} [$__auto]))`
    );
  });
  test('should build metadata query', () => {
    const metadataVariable = new AdHocFiltersVariable({
      name: VAR_METADATA,
      filters: [],
    });
    const nameField: Field = {
      name: DETECTED_FIELDS_NAME_FIELD,
      type: FieldType.string,
      values: ['caller'],
      config: {},
    };
    const cardinalityField: Field = {
      name: DETECTED_FIELDS_CARDINALITY_NAME,
      type: FieldType.number,
      values: [5],
      config: {},
    };
    const parserField: Field = {
      name: DETECTED_FIELDS_PARSER_NAME,
      type: FieldType.string,
      values: [''],
      config: {},
    };
    const typeField: Field = {
      name: DETECTED_FIELDS_TYPE_NAME,
      type: FieldType.string,
      values: ['string'],
      config: {},
    };

    const detectedFieldsFrame: DataFrame = createDataFrame({
      fields: [nameField, cardinalityField, parserField, typeField],
    });

    const result = buildFieldsQueryString('caller', metadataVariable, detectedFieldsFrame);
    expect(result).toEqual(
      `sum by (caller) (count_over_time({\${filters}} | caller!="" \${levels} \${metadata} \${patterns} \${lineFilters}  \${fields} [$__auto]))`
    );
  });
});
