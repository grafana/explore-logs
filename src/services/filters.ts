import { DetectedLabel } from './fields';
import {
  ALL_VARIABLE_VALUE,
  isAdHocFilterValueUserInput,
  LEVEL_VARIABLE_VALUE,
  stripAdHocFilterUserInputPrefix,
} from './variables';
import { VariableValueOption } from '@grafana/scenes';

// We want to show labels with cardinality 1 at the end of the list because they are less useful
// And then we want to sort by cardinality - from lowest to highest
export function sortLabelsByCardinality(a: DetectedLabel, b: DetectedLabel) {
  if (a.cardinality === 1) {
    return 1;
  }
  if (b.cardinality === 1) {
    return -1;
  }
  return a.cardinality - b.cardinality;
}

// Creates label options by taking all labels and if LEVEL_VARIABLE_VALUE is not in the list, it is added at the beginning.
// It also adds 'All' option at the beginning
export function getLabelOptions(labels: string[]) {
  const options = [...labels];
  if (!labels.includes(LEVEL_VARIABLE_VALUE)) {
    options.unshift(LEVEL_VARIABLE_VALUE);
  }

  const labelOptions: VariableValueOption[] = options.map((label) => ({
    label,
    value: String(label),
  }));

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...labelOptions];
}
export const LEVEL_INDEX_NAME = 'level';
export const FIELDS_TO_REMOVE = ['level_extracted', LEVEL_VARIABLE_VALUE, LEVEL_INDEX_NAME];

export const LABELS_TO_REMOVE = ['__aggregated_metric__', '__stream_shard__'];
export function getFieldOptions(labels: string[]) {
  const options = [...labels];
  const labelOptions: VariableValueOption[] = options.map((label) => ({
    label,
    value: String(label),
  }));

  return [{ label: 'All', value: ALL_VARIABLE_VALUE }, ...labelOptions];
}

// Since "meta" is not saved in the URL state, it's ephemeral and can only be used for wip keys, but we can differentiate fields from metadata if the value is not encoded (and therefore different then the label)
export function isFilterMetadata(filter: { value: string; valueLabels?: string[] }) {
  const value = isAdHocFilterValueUserInput(filter.value)
    ? stripAdHocFilterUserInputPrefix(filter.value)
    : filter.value;
  return value === filter.valueLabels?.[0];
}
