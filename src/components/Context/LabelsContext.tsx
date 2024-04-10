import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { TimeRange } from '@grafana/data';

import { useDataSource } from '@/hooks/useDataSource';
import { useTimeRange } from '@/hooks/useTimeRange';
import { LokiDatasource } from '@/services/lokiTypes';
import { buildLogSelector } from '@/services/query';

import { Filter, FilterOp, FilterType, useQueryContext } from './QueryContext';

export type LabelsContextType = {
  isOpen: boolean;
  isLoading: boolean;
  labels: ContextLabel[];
  select(label: string, value: string): void;
  deselect(label: string, value?: string): void;
  setLabelValues(label: string, values: ContextLabelValue[]): void;
  openLabelBrowser(): void;
  closeLabelBrowser(): void;
};

export interface ContextLabelValue {
  value: string;
  disabled?: boolean;
}

export type ContextLabel = {
  name: string;
  disabled?: boolean;
  valuesFetched?: boolean;
  values?: ContextLabelValue[];
};

export const initialState = {
  isOpen: false,
  isLoading: false,
  labels: [],
  selectedLabels: [],
  openLabelBrowser: () => {},
  closeLabelBrowser: () => {},
  select: () => {},
  deselect: () => {},
  setLabelValues: () => {},
};

type Props = {
  children: ReactNode[] | ReactNode;
  open?: boolean;
};

export const LabelsContext = createContext<LabelsContextType>(initialState);

const FILTERED_LABELS = ['__stream_shard__'];

export const LabelsContextProvider = ({ children, open: openIntialState = false }: Props) => {
  const [isOpen, setOpen] = useState(openIntialState);
  const [isLoading, setIsLoading] = useState(false);
  const [labels, setLabels] = useState<ContextLabel[]>([]);
  const { addLabelFilter, removeLabelFilter } = useQueryContext();
  const timeRange = useTimeRange();
  const dataSource = useDataSource();

  const fetchLabels = useCallback(() => {
    setIsLoading(true);
    dataSource?.languageProvider
      .fetchLabels({ timeRange })
      .then((labels) => {
        setLabels(labels.filter((name) => !FILTERED_LABELS.includes(name)).map((name) => ({ name })));
      })
      .catch((error) => {
        console.error(error);
        setLabels([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [dataSource?.languageProvider, timeRange]);

  const resetLabels = useCallback(() => {
    setLabels(
      labels.map((label) => {
        label.disabled = undefined;
        // Values were fetched from /values
        if (label.valuesFetched) {
          label.values = label.values?.map((labelValue) => {
            labelValue.disabled = undefined;
            return labelValue;
          });
        } else {
          // Values were derived from /series, reset
          label.values = [];
        }

        return label;
      })
    );
  }, [labels]);

  const updateLabelsAfterSelectionChange = useCallback(
    (filters: Filter[]) => {
      // No selected labels, reset values derived from updateValuesFromCurrentSelection()
      if (filters.length === 0) {
        resetLabels();
        return;
      }
      if (dataSource) {
        setIsLoading(true);
        updateValuesFromCurrentSelection(labels, filters, dataSource, timeRange)
          .then((updatedLabels) => {
            setLabels(updatedLabels);
            setIsLoading(false);
          })
          .catch(console.error);
      }
    },
    [dataSource, labels, resetLabels, timeRange]
  );

  // Update labels based on the current datasource and time range
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const openLabelBrowser = useCallback(() => setOpen(true), []);
  const closeLabelBrowser = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (label: string, value: string) => {
      const newFilters = addLabelFilter(label, value, FilterType.IndexedLabel, FilterOp.Equal);
      updateLabelsAfterSelectionChange(newFilters);
    },
    [addLabelFilter, updateLabelsAfterSelectionChange]
  );
  /**
   * @string label Label to select
   * @string|undefined value Optional value. If not provided, it removes the label and all values.
   */
  const deselect = useCallback(
    (label: string, value?: string) => {
      const newFilters = removeLabelFilter(label, value);
      updateLabelsAfterSelectionChange(newFilters);
    },
    [removeLabelFilter, updateLabelsAfterSelectionChange]
  );
  /**
   * Used by useLabelValues() to update values to those received by fetchLabelValues().
   */
  const setLabelValues = useCallback(
    (labelName: string, values: ContextLabelValue[]) => {
      setLabels(
        labels.map((label) => {
          if (label.name === labelName) {
            label.values = values;
            label.valuesFetched = true;
          }
          return label;
        })
      );
    },
    [labels]
  );

  const value = {
    isOpen,
    isLoading,
    labels,
    openLabelBrowser,
    closeLabelBrowser,
    select,
    deselect,
    setLabelValues,
  };

  return <LabelsContext.Provider value={value}>{children}</LabelsContext.Provider>;
};

async function updateValuesFromCurrentSelection(
  labels: ContextLabel[],
  filters: Filter[],
  dataSource: LokiDatasource,
  timeRange: TimeRange
): Promise<ContextLabel[]> {
  const selector = buildLogSelector(filters) || '';
  const labelValueMap = (await dataSource?.languageProvider.fetchSeriesLabels(selector, { timeRange })) || [];
  labels.forEach((label) => {
    if (label.values) {
      // Mark all previous values as disabled
      label.values = label.values.map((labelValue) => ({ ...labelValue, disabled: true }));
    }
    // Enable values present in labelValueMap and add new values from /series
    if (labelValueMap[label.name]) {
      label.values = label.values || [];
      labelValueMap[label.name].forEach((value) => {
        const labelValue = label.values?.find((labelValue) => labelValue.value === value);
        if (labelValue) {
          labelValue.disabled = false;
        } else {
          label.values?.push({ value });
        }
      });
      label.disabled = false;
    } else {
      // Label not present in /series response
      label.disabled = true;
    }
  });
  return [...labels];
}

export const useLabelsContext = () => {
  return useContext(LabelsContext);
};
