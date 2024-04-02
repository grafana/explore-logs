import { useQueryContext } from '../Context/QueryContext';

export const useQueryExpression = () => {
  const { queryExpression } = useQueryContext();
  return queryExpression;
};

export const useDataFrame = () => {
  const { dataFrame } = useQueryContext();
  return dataFrame;
};
