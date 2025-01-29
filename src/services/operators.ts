import { FilterOp, LineFilterOp } from './filterTypes';
import { SelectableValue } from '@grafana/data';

// function getOperatorLabel(op: FilterOp): string {
//   if (op === FilterOp.NotEqual) {
//     return 'Not equal';
//   }
//   if (op === FilterOp.RegexNotEqual) {
//     return 'Regex: Not equal';
//   }
//   if (op === FilterOp.Equal) {
//     return 'Equal';
//   }
//   if (op === FilterOp.RegexEqual) {
//     return 'Regex: Equal';
//   }
//
//   return op.toString();
// }

export const operators = [FilterOp.Equal, FilterOp.NotEqual, FilterOp.RegexEqual, FilterOp.RegexNotEqual].map<
  SelectableValue<string>
>((value, index, array) => {
  return {
    // label: getOperatorLabel(value), // @todo return better labels?
    label: value, // @todo return better labels?
    value,
  };
});

export const includeOperators = [FilterOp.Equal, FilterOp.RegexEqual].map<SelectableValue<string>>((value) => ({
  label: value,
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
export const isOperatorRegex = (op: string | FilterOp): boolean => {
  return op === FilterOp.RegexEqual || op === FilterOp.RegexNotEqual;
};
