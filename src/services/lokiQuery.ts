// Warning: This file (and any imports) are included in the main bundle with Grafana in order to provide link extension support in Grafana core, in an effort to keep Grafana loading quickly, please do not add any unnecessary imports to this file and run the bundle analyzer before committing any changes!
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
