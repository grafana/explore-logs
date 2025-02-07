import { FilterOp, FilterOpType, LineFilterOp, NumericFilterOp } from './filterTypes';
import { SelectableValue } from '@grafana/data';
import { logger } from './logger';

function getOperatorDescription(op: FilterOpType): string {
  if (op === FilterOp.NotEqual) {
    return 'Not equal';
  }
  if (op === FilterOp.RegexNotEqual) {
    return 'Does not match regex';
  }
  if (op === FilterOp.Equal) {
    return 'Equals';
  }
  if (op === FilterOp.RegexEqual) {
    return 'Matches regex';
  }
  if (op === FilterOp.lt) {
    return 'Less than';
  }
  if (op === FilterOp.gt) {
    return 'Greater than';
  }
  if (op === FilterOp.gte) {
    return 'Greater than or equal to';
  }
  if (op === FilterOp.lte) {
    return 'Less than or equal to';
  }

  const error = new Error('Invalid operator!');
  logger.error(error, { msg: 'Invalid operator', operator: op });
  throw error;
}

export const operators = [FilterOp.Equal, FilterOp.NotEqual, FilterOp.RegexEqual, FilterOp.RegexNotEqual].map<
  SelectableValue<string>
>((value, index, array) => {
  return {
    description: getOperatorDescription(value),
    label: value,
    value,
  };
});

export const includeOperators = [FilterOp.Equal, FilterOp.RegexEqual].map<SelectableValue<string>>((value) => ({
  description: getOperatorDescription(value),
  label: value,
  value,
}));

export const numericOperatorArray = [FilterOp.gt, FilterOp.gte, FilterOp.lt, FilterOp.lte];

export const numericOperators = numericOperatorArray.map<SelectableValue<string>>((value) => ({
  description: getOperatorDescription(value),
  label: value,
  value,
}));

export const lineFilterOperators: SelectableValue[] = [
  { label: 'match', value: LineFilterOp.match },
  { label: 'negativeMatch', value: LineFilterOp.negativeMatch },
  { label: 'regex', value: LineFilterOp.regex },
  { label: 'negativeRegex', value: LineFilterOp.negativeRegex },
];

export const isOperatorInclusive = (op: string | FilterOpType): boolean => {
  return op === FilterOp.Equal || op === FilterOp.RegexEqual;
};
export const isOperatorExclusive = (op: string | FilterOpType): boolean => {
  return op === FilterOp.NotEqual || op === FilterOp.RegexNotEqual;
};
export const isOperatorRegex = (op: string | FilterOpType): boolean => {
  return op === FilterOp.RegexEqual || op === FilterOp.RegexNotEqual;
};
export const isOperatorNumeric = (op: string | NumericFilterOp): boolean => {
  return numericOperatorArray.includes(op);
};
