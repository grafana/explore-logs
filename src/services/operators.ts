import { FilterOp, LineFilterOp } from './filterTypes';
import { SelectableValue } from '@grafana/data';
import { getOperatorDescription } from './getOperatorDescription';

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
