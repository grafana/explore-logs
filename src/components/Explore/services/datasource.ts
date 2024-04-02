import { DataSourceRef } from '@grafana/schema';

export function isLokiDatasource(dataSource: DataSourceRef | null | undefined) {
  return dataSource?.type === 'loki';
}
