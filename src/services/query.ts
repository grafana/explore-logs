import { PLUGIN_ID } from './routing';

export const buildLokiQuery = (expr: string, queryParamsOverrides?: Record<string, unknown>) => {
  return {
    ...defaultQueryParams,
    ...queryParamsOverrides,
    expr,
  };
};

const defaultQueryParams = {
  refId: 'A',
  queryType: 'range',
  editorMode: 'code',
  supportingQueryType: PLUGIN_ID,
};
