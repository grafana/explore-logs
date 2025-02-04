// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!

import { LabelType } from './fieldsTypes';
import { ParserType } from './variables';

export enum FilterOp {
  Equal = '=',
  NotEqual = '!=',
  gt = '>',
  lt = '<',
  gte = '>=',
  lte = '<=',

  RegexEqual = '=~',
  RegexNotEqual = '!~',
}

export type IndexedLabelFilter = {
  key: string;
  operator: FilterOp;
  value: string;
  type?: LabelType;
};

export type FieldFilter = {
  key: string;
  operator: FilterOp;
  value: string;
  type?: LabelType;
  parser?: ParserType;
};

export type LineFilterType = {
  key: string;
  operator: LineFilterOp;
  value: string;
};

export type PatternFilterType = {
  operator: PatternFilterOp;
  value: string;
};

export enum LineFilterOp {
  match = '|=',
  negativeMatch = `!=`,
  regex = '|~',
  negativeRegex = `!~`,
}

export enum PatternFilterOp {
  match = '|>',
  negativeMatch = '!>',
}

export enum LineFilterCaseSensitive {
  caseSensitive = 'caseSensitive',
  caseInsensitive = 'caseInsensitive',
}
