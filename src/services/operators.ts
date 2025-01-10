import { FilterOp, LineFilterOp } from './filterTypes';
import { SelectableValue } from '@grafana/data';

const getLabelForOperator = (op: FilterOp): string => {
  switch (op) {
    case FilterOp.Equal:
      return 'Equal';
    case FilterOp.NotEqual:
      return 'Not equal';
    case FilterOp.RegexEqual:
      return 'Regex equal';
    case FilterOp.RegexNotEqual:
      return 'Regex not equal';
    default:
      console.error('invalid operator');
      throw new Error('invalid operator!');
  }
};

export const operators = [FilterOp.Equal, FilterOp.NotEqual, FilterOp.RegexEqual, FilterOp.RegexNotEqual].map<
  SelectableValue<string>
>((value, index, array) => {
  return {
    label: getLabelForOperator(value),
    value,
  };
});

export const includeOperators = [FilterOp.Equal, FilterOp.RegexEqual].map<SelectableValue<string>>((value) => ({
  label: getLabelForOperator(value),
  value,
}));

export const numericOperatorArray = [FilterOp.gt, FilterOp.gte, FilterOp.lt, FilterOp.lte];

export const numericOperators = numericOperatorArray.map<SelectableValue<string>>((value) => ({
  label: value,
  value,
}));

export const lineFilterOperators: SelectableValue[] = [
  { label: 'match', value: LineFilterOp.match },
  { label: 'negativeMatch', value: LineFilterOp.negativeMatch },
  { label: 'regex', value: LineFilterOp.regex },
  { label: 'negativeRegex', value: LineFilterOp.negativeRegex },
];

export const isOperatorInclusive = (op: string | FilterOp): boolean => {
  return op === FilterOp.Equal || op === FilterOp.RegexEqual;
};
export const isOperatorExclusive = (op: string | FilterOp): boolean => {
  return op === FilterOp.NotEqual || op === FilterOp.RegexNotEqual;
};
