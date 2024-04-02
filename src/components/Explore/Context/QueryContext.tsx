import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Subscription } from 'rxjs';

import { DataFrame, DataQueryResponse, getTimeZone, sortDataFrame, TimeRange } from '@grafana/data';

import { useDataSource } from '../hooks/useDataSource';
import { useTimeRange } from '../hooks/useTimeRange';
import { useUrlParameter } from '../hooks/useUrlParameter';
import { LogsFrame, parseLogsFrame } from '../services/logsFrame';
import { buildQueryFromFilters } from '../services/query';
import { UrlParameterType } from '../services/routing';

export type Label = { name: string; values: string[]; indexed: boolean };

export type QueryContextType = {
  isLoading: boolean;
  filters: Filter[];
  remove(filter: Filter): void;
  addLabelFilter(key: string, value: string, type: FilterType, op: FilterOp): Filter[];
  removeLabelFilter(key: string, value?: string): Filter[];
  clear(): void;
  selectedLabels: Label[];
  queryExpression: string;
  dataFrame: DataFrame | null;
  logsFrame: LogsFrame | null;
};

export enum FilterType {
  IndexedLabel = 'IndexedLabel',
  NonIndexedLabel = 'NonIndexedLabel',
  // Line, IP, etc
}

export enum FilterOp {
  Equal = '=',
  NotEqual = '!=',
}

export type Filter = {
  type: FilterType;
  op: FilterOp;
  key: string;
  values: string[];
};

export const initialState = {
  isLoading: false,
  filters: [],
  addLabelFilter: () => [],
  removeLabelFilter: () => [],
  remove: () => {},
  clear: () => {},
  selectedLabels: [],
  queryExpression: '',
  dataFrame: null,
  logsFrame: null,
};

export const QueryContext = createContext<QueryContextType>(initialState);

export const QueryContextProvider = ({ children }: { children: ReactNode }) => {
  const [labelsFromQuery, setLabelsFromQuery] = useUrlParameter<Filter[]>(UrlParameterType.Labels);
  const [filters, setFilters] = useState<Filter[]>(labelsFromQuery || []);
  const [isLoading, setIsLoading] = useState(false);
  const querySubscriptionRef = useRef<Subscription | null>(null);
  const [queryExpression, setQueryExpression] = useState('');
  const [dataFrame, setDataFrame] = useState<DataFrame | null>(null);
  const [logsFrame, setLogsFrame] = useState<LogsFrame | null>(null);
  const timeRange = useTimeRange();
  const dataSource = useDataSource();

  useEffect(() => {
    setLabelsFromQuery(filters);
  }, [filters, setLabelsFromQuery]);

  const selectedLabels = useMemo(() => getSelectedLabels(filters), [filters]);

  useEffect(() => {
    setQueryExpression(buildQueryFromFilters(filters));
  }, [filters]);

  useEffect(() => {
    if (!dataSource || !queryExpression) {
      setDataFrame(null);
      return;
    }
    if (querySubscriptionRef.current) {
      querySubscriptionRef.current.unsubscribe();
    }
    const subscription = dataSource
      .query({
        targets: [{ refId: 'logs-app', expr: queryExpression }],
        ...getQueryBase(timeRange),
      })
      .subscribe({
        next: (response: DataQueryResponse) => {
          if (response.data === null) {
            setDataFrame(null);
            return;
          }
          const frames = response.data
            .map((frame) => {
              const logsFrame = parseLogsFrame(frame);
              if (!logsFrame) {
                return null;
              }

              // for now we sort the newest logs first
              return sortDataFrame(logsFrame.raw, logsFrame.timeField.index, true);
            })
            .filter((frame) => frame !== null) as DataFrame[];
          setDataFrame(frames[0]);
        },
        complete: () => {
          setIsLoading(false);
        },
        error: () => {
          setIsLoading(false);
          setDataFrame(null);
        },
      });
    querySubscriptionRef.current = subscription;
  }, [dataSource, queryExpression, timeRange]);

  useEffect(() => {
    if (dataFrame) {
      setLogsFrame(parseLogsFrame(dataFrame));
    }
  }, [dataFrame]);

  const addLabelFilter = useCallback(
    (label: string, value: string, type: FilterType, op = FilterOp.Equal) => {
      const newFilters = [...filters];
      let labelFilter = newFilters.find(({ key }) => key === label);
      if (!labelFilter) {
        newFilters.push({ type, key: label, values: [value], op });
      } else {
        labelFilter.op = op;
        labelFilter.values = [...labelFilter.values, value];
      }
      setFilters(newFilters);
      return newFilters;
    },
    [filters]
  );
  /**
   * @string label Label to select
   * @string|undefined value Optional value. If not provided, it removes the label and all values.
   */
  const removeLabelFilter = useCallback(
    (label: string, value?: string) => {
      let newFilters: Filter[];
      // No value provided, remove label with all values
      if (!value) {
        newFilters = filters.filter(({ type, key }) => (key === label ? false : true));
      } else {
        // Remove the value from the selected labels
        const labelFilter = filters.find(({ type, key }) => key === label);
        if (!labelFilter) {
          // Should never happen. Array.find() can return undefined
          console.error(`${label} not found as selected label`);
          return filters;
        }
        labelFilter.values = labelFilter.values.filter((labelValue) => labelValue !== value);
        // All values removed, remove label
        if (labelFilter.values.length === 0) {
          newFilters = filters.filter(({ type, key }) => (key === label ? false : true));
        } else {
          newFilters = filters;
        }
      }
      setFilters([...newFilters]);
      return newFilters;
    },
    [filters]
  );

  const clear = useCallback(() => {
    setFilters([]);
  }, []);

  const remove = useCallback(
    (target: Filter) => {
      setFilters(filters.filter((filter) => filter !== target));
    },
    [filters]
  );

  return (
    <QueryContext.Provider
      value={{
        isLoading,
        filters,
        addLabelFilter,
        removeLabelFilter,
        remove,
        clear,
        selectedLabels,
        queryExpression,
        dataFrame,
        logsFrame,
      }}
    >
      {children}
    </QueryContext.Provider>
  );
};

function getQueryBase(range: TimeRange) {
  return {
    requestId: 'logs-app',
    interval: '1s',
    intervalMs: 1000,
    range,
    scopedVars: {},
    timezone: getTimeZone(),
    app: 'logs',
    startTime: Date.now(),
  };
}

function getSelectedLabels(filters: Filter[]): Label[] {
  return filters
    .filter((filter) => [FilterType.IndexedLabel, FilterType.NonIndexedLabel].includes(filter.type))
    .map(({ key, values, type }) => ({ name: key, values, indexed: type === FilterType.IndexedLabel }));
}

export const useQueryContext = () => {
  return useContext(QueryContext);
};
