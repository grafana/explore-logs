import { PLUGIN_ID } from './routing';

export type LokiQuery = {
  refId: string;
  queryType: string;
  editorMode: string;
  supportingQueryType: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;
};
export const buildLokiQuery = (expr: string, queryParamsOverrides?: Record<string, unknown>): LokiQuery => {
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
