import { SelectableValue } from '@grafana/data';
import { DetectedLabel } from './fields';
import { getFieldOptions, getLabelOptions, sortLabelsByCardinality } from './filters';
import { ALL_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE } from './variables';

describe('sortLabelsByCardinality', () => {
  it('should move labels with cardinality 1 to the end', () => {
    const labels: DetectedLabel[] = [
      { label: 'Label A', cardinality: 3 },
      { label: 'Label B', cardinality: 1 },
      { label: 'Label C', cardinality: 2 },
    ];

    const sortedLabels = labels.sort(sortLabelsByCardinality);

    expect(sortedLabels).toEqual([
      { label: 'Label C', cardinality: 2 },
      { label: 'Label A', cardinality: 3 },
      { label: 'Label B', cardinality: 1 },
    ]);
  });

  it('should sort labels by cardinality in ascending order, except those with cardinality 1', () => {
    const labels: DetectedLabel[] = [
      { label: 'Label A', cardinality: 5 },
      { label: 'Label B', cardinality: 1 },
      { label: 'Label C', cardinality: 3 },
      { label: 'Label D', cardinality: 1 },
      { label: 'Label E', cardinality: 2 },
    ];

    const sortedLabels = labels.sort(sortLabelsByCardinality);

    expect(sortedLabels).toEqual([
      { label: 'Label E', cardinality: 2 },
      { label: 'Label C', cardinality: 3 },
      { label: 'Label A', cardinality: 5 },
      { label: 'Label B', cardinality: 1 },
      { label: 'Label D', cardinality: 1 },
    ]);
  });

  it('should return 0 if both labels have the same cardinality and are not 1', () => {
    const labelA: DetectedLabel = { label: 'Label A', cardinality: 3 };
    const labelB: DetectedLabel = { label: 'Label B', cardinality: 3 };

    expect(sortLabelsByCardinality(labelA, labelB)).toBe(0);
  });

  it('should place label with cardinality 1 at the end if only one label has cardinality 1', () => {
    const labelA: DetectedLabel = { label: 'Label A', cardinality: 1 };
    const labelB: DetectedLabel = { label: 'Label B', cardinality: 2 };

    expect(sortLabelsByCardinality(labelA, labelB)).toBe(1);
    expect(sortLabelsByCardinality(labelB, labelA)).toBe(-1);
  });
});

describe('getLabelOptions', () => {
  it('should add LEVEL_VARIABLE_VALUE at the beginning if it is not in the list', () => {
    const labels = ['Label A', 'Label B'];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
      { label: 'Label A', value: 'Label A' },
      { label: 'Label B', value: 'Label B' },
    ];

    expect(getLabelOptions(labels)).toEqual(expectedOptions);
  });

  it('should not add LEVEL_VARIABLE_VALUE if it is already in the list', () => {
    const labels = [LEVEL_VARIABLE_VALUE, 'Label A', 'Label B'];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
      { label: 'Label A', value: 'Label A' },
      { label: 'Label B', value: 'Label B' },
    ];

    expect(getLabelOptions(labels)).toEqual(expectedOptions);
  });

  it('should remove level if it is present in the list', () => {
    const labels = [LEVEL_VARIABLE_VALUE, 'level', 'Label A'];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
      { label: 'Label A', value: 'Label A' },
    ];

    expect(getLabelOptions(labels)).toEqual(expectedOptions);
  });

  it('should always add the All option at the beginning', () => {
    const labels = ['Label A', 'Label B'];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
      { label: 'Label A', value: 'Label A' },
      { label: 'Label B', value: 'Label B' },
    ];

    expect(getLabelOptions(labels)).toEqual(expectedOptions);
  });

  it('should work correctly with an empty label list', () => {
    const labels: string[] = [];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: LEVEL_VARIABLE_VALUE, value: LEVEL_VARIABLE_VALUE },
    ];

    expect(getLabelOptions(labels)).toEqual(expectedOptions);
  });
});

describe('getFieldOptions', () => {
  it('should always add the All option at the beginning', () => {
    const labels = ['Label A', 'Label B'];
    const expectedOptions: Array<SelectableValue<string>> = [
      { label: 'All', value: ALL_VARIABLE_VALUE },
      { label: 'Label A', value: 'Label A' },
      { label: 'Label B', value: 'Label B' },
    ];

    expect(getFieldOptions(labels)).toEqual(expectedOptions);
  });

  it('should work correctly with an empty label list', () => {
    const labels: string[] = [];
    const expectedOptions: Array<SelectableValue<string>> = [{ label: 'All', value: ALL_VARIABLE_VALUE }];

    expect(getFieldOptions(labels)).toEqual(expectedOptions);
  });
});
