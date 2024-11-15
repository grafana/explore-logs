// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!
import { LabelType } from './fieldsTypes';

export enum FilterOp {
  Equal = '=',
  NotEqual = '!=',
  gt = '>',
  lt = '<',
  gte = '>=',
  lte = '<=',
}

export type Filter = {
  key: string;
  operator: FilterOp;
  value: string;
  type?: LabelType;
};
