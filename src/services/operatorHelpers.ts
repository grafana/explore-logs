import { FilterOp, FilterOpType, NumericFilterOp } from './filterTypes';
import { numericOperatorArray } from './operators';

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
