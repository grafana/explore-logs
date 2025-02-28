import { FilterOp, FilterOpType } from './filterTypes';
// Importing the logger here breaks e2e tests as this file is included in the explore.ts
// I do not know why though
// import { logger } from './logger';

export function getOperatorDescription(op: FilterOpType): string {
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
  throw error;
  // logger.error(error, { msg: 'Invalid operator', operator: op });
  // throw error;
}
