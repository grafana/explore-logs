import { DataSourceRef } from '@grafana/schema';

export type LokiQuery = {
  refId: string;
  queryType: string;
  editorMode: string;
  supportingQueryType: string;
  expr: string;
  legendFormat?: string;
  splitDuration?: string;
  datasource?: DataSourceRef;
  maxLines?: number;
};
