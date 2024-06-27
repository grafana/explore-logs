import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import React from 'react';

export const AggregationTypes = {
  count: {
    label: 'Count Values',
    value: 'count_over_time',
    description: 'Count distinct values in the field over time.',
  },
  sum: { label: 'Sum', value: 'sum_over_time', description: 'Sum of values in the field over time.' },
  avg: { label: 'Avg', value: 'avg_over_time', description: 'Average of values in the field over time.' },
  min: { label: 'Min', value: 'min_over_time', description: 'Minimum value in the field over time.' },
  max: { label: 'Max', value: 'max_over_time', description: 'Maximum value in the field over time.' },
  p50: {
    label: 'P50',
    value: '0.5',
    description: '50th percentile of values in the field over time.',
  },
  p75: {
    label: 'P75',
    value: '0.75',
    description: '75th percentile of values in the field over time.',
  },
  p90: {
    label: 'P90',
    value: '0.9',
    description: '90th percentile of values in the field over time.',
  },
  rate: { label: 'rate', value: 'rate', description: 'Rate of change of values in the field over time.' },
};

const options = Object.entries(AggregationTypes).map((value) => ({
  value: value[1].value,
  label: value[1].label,
  description: value[1].description,
}));

type BreakdownAggrSelectorProps = {
  aggregation: string | undefined;
  onAggregationChange: (aggregation: SelectableValue<string>) => void;
};

export const BreakdownAggrSelector = (props: BreakdownAggrSelectorProps) => {
  const { aggregation, onAggregationChange } = props;

  return <Select options={options} value={aggregation} onChange={onAggregationChange} />;
};
