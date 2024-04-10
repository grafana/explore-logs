import { FieldType } from '@grafana/data';

export type ActiveFieldMeta = {
  active: false;
  index: undefined; // if undefined the column is not selected
};

export type InactiveFieldMeta = {
  active: true;
  index: number; // if undefined the column is not selected
};

export type GenericMeta = {
  percentOfLinesWithLabel: number;
  type?: 'BODY_FIELD' | 'TIME_FIELD' | 'LINK_FIELD';
  cardinality: number;
  maxLength?: number;
  detectedFieldType?: FieldType;
};

export type FieldNameMeta = (InactiveFieldMeta | ActiveFieldMeta) & GenericMeta;

export type FieldName = string;
export type FieldNameMetaStore = Record<FieldName, FieldNameMeta>;
