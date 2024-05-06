import { PLUGIN_ID } from './routing';

export const buildLogVolumeQuery = (expr: string, overrides?: Record<string, unknown>) => {
  return {
    legendFormat: '{{level}}',
    expr,
    ...defaultQueryParams,
    ...overrides,
  };
};

export const buildLogQuery = (expr: string, overrides?: Record<string, unknown>) => {
  return {
    maxLines: 1000,
    expr,
    ...defaultQueryParams,
    ...overrides,
  };
};

const defaultQueryParams = {
  refId: 'A',
  queryType: 'range',
  editorMode: 'code',
  supportingQueryType: PLUGIN_ID,
};
