/**
 * Shorthand versions of low level hooks.
 */
import { useCallback, useEffect, useState } from 'react';

import { ContextLabelValue, useLabelsContext } from '../Context/LabelsContext';
import { FilterOp, FilterType, useQueryContext } from '../Context/QueryContext';

import { useDataSource } from './useDataSource';

export function useLabels() {
  const { labels } = useLabelsContext();
  return labels;
}

export function useLabel(name: string) {
  const { labels } = useLabelsContext();
  return labels.find((label) => label.name === name);
}

/**
 * Get values for a label, from the Context if they are available, otherwise from Loki.
 * @param labelName Label name
 * @param updateValuesInContext Set to true to update the context with the received values
 * @returns
 */
export const useLabelValues = (labelName: string, updateValuesInContext = false) => {
  const { labels, setLabelValues } = useLabelsContext();
  const dataSource = useDataSource();
  const [values, setValues] = useState<ContextLabelValue[]>(
    labels.find((label) => label.name === labelName)?.values || []
  );
  const [isLoading, setIsLoading] = useState(true);

  // Sync values with context
  useEffect(() => {
    const label = labels.find((label) => label.name === labelName);
    if (label && label.values) {
      setValues(label.values);
    }
  }, [labelName, labels]);

  // Fetch values if not available
  useEffect(() => {
    // Values already available
    if (values.length > 0 || !dataSource) {
      setIsLoading(false);
      return;
    }
    dataSource?.languageProvider
      .fetchLabelValues(labelName)
      .then((newValues) => {
        setValues(newValues.map((value) => ({ value })));
        if (updateValuesInContext) {
          setLabelValues(
            labelName,
            newValues.map((value) => ({ value }))
          );
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [dataSource, labelName, setLabelValues, updateValuesInContext, values.length]);

  return { values, isLoading: isLoading };
};

export function useLabelIsSelected(name: string): boolean {
  const { selectedLabels } = useQueryContext();
  return selectedLabels.findIndex((label) => label.name === name) >= 0;
}

export function useLabelValueIsSelected(name: string, value: string): boolean {
  const { selectedLabels } = useQueryContext();
  const label = selectedLabels.find((label) => label.name === name);
  if (!label) {
    return false;
  }
  return Boolean(label.values?.includes(value));
}

export const useLabelFilters = () => {
  const indexedLabels = useLabels();
  const queryContext = useQueryContext();

  const addLabelFilter = useCallback(
    (key: string, value: string, op = FilterOp.Equal) => {
      const indexed = indexedLabels.find((label) => label.name === key);
      queryContext.addLabelFilter(key, value, indexed ? FilterType.IndexedLabel : FilterType.NonIndexedLabel, op);
    },
    [indexedLabels, queryContext]
  );

  return { addLabelFilter, removeLabelFilter: queryContext.removeLabelFilter };
};
