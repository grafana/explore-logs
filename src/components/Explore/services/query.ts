import { uniqueId } from 'lodash';

import { DataQueryRequest, getTimeZone, rangeUtil, TimeRange } from '@grafana/data';

import { Filter, FilterOp, FilterType } from '../Context/QueryContext';
import {
  DATAPLANE_BODY_NAME,
  DATAPLANE_ID_NAME,
  DATAPLANE_LABELS_NAME,
  DATAPLANE_SEVERITY_NAME,
  DATAPLANE_TIMESTAMP_NAME,
} from './logsFrame';

import pluginJson from '../../../plugin.json';

import { LokiDatasource, LokiQuery, LokiQueryType } from './lokiTypes';

const buildSelectorFromLabels = (filters: Filter[]): string[] => {
  const defaultValue: string[] = [];
  return filters
    .filter(({ type }) => type === FilterType.IndexedLabel)
    .sort((labelA, labelB) => labelA.key.localeCompare(labelB.key))
    .reduce((acc, label) => {
      if (!label.values || label.values.length === 0) {
        return [...acc, `${label.key}=~".+"`];
      }
      if (label.values.length === 1) {
        return [...acc, `${label.key}${label.op}"${label.values[0]}"`];
      } else {
        const op = label.op === FilterOp.Equal ? '=~' : '!~';
        const joinedValues = label.values.sort((valueA, valueB) => valueA.localeCompare(valueB)).join('|');
        const captureGroup = `(${joinedValues})`;
        return [...acc, `${label.key}${op}"${captureGroup}"`];
      }
    }, defaultValue);
};

export const buildLogSelector = (filters: Filter[]): string => {
  const queryParts = buildSelectorFromLabels(filters);
  return `{${queryParts.join(',')}}`;
};

export const buildLabelFilter = (filters: Filter[]): string => {
  // TODO: replace with Grafana functionality
  return filters
    .filter(({ type }) => type === FilterType.NonIndexedLabel)
    .map((filter) => filter.values.map((value) => `${filter.key}${filter.op}\`${value}\``))
    .join(' | ');
};

export const buildQueryFromFilters = (filters: Filter[]) => {
  if (!filters.length) {
    return '';
  }
  const labelFilters = buildLabelFilter(filters);
  return `${buildLogSelector(filters)} ${QUERY_PARSER_EXPRESSION} ${labelFilters ? `| ${labelFilters}` : ''}`.trim();
};

export const QUERY_PARSER_EXPRESSION = `| logfmt | json | drop __error__, __error_details__, ${DATAPLANE_TIMESTAMP_NAME}, ${DATAPLANE_BODY_NAME}, ${DATAPLANE_ID_NAME}, ${DATAPLANE_LABELS_NAME}, ${DATAPLANE_SEVERITY_NAME}`;

export const buildDataQueryRequest = (
  query: string,
  timeRange: TimeRange,
  dataSource: LokiDatasource
): DataQueryRequest<LokiQuery> => {
  // This is hard coded and for log queries not needed, but it's required by the backend
  const resolution = 100;
  const { intervalMs, interval } = rangeUtil.calculateInterval(timeRange, resolution, '1ms');
  return {
    requestId: uniqueId(pluginJson.id),
    interval,
    intervalMs,
    range: timeRange,
    scopedVars: {},
    timezone: getTimeZone(),
    app: pluginJson.id,
    startTime: Date.now(),
    targets: [
      {
        refId: 'A',
        expr: query,
        datasource: dataSource,
        queryType: LokiQueryType.Range,
      },
    ],
  };
};
