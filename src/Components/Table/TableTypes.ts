import { FieldType } from '@grafana/data';

export type InactiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

export type ActiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

export type GenericMeta = {
  percentOfLinesWithLabel: number;
  type?: 'BODY_FIELD' | 'TIME_FIELD' | 'LINK_FIELD';
  cardinality: number;
  maxLength?: number;
  fieldType?: FieldType;
};

export type FieldNameMeta = (ActiveFieldMeta | InactiveFieldMeta) & GenericMeta;

export type FieldName = string;
export type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;
