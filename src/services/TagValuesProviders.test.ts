import { AdHocFilterWithLabels } from '@grafana/scenes';
import { LabelFilterOp } from './filterTypes';
import { tagValuesFilterAdHocFilters } from './TagValuesProviders';

const getNewFilter = (key: string, operator: LabelFilterOp): AdHocFilterWithLabels => {
  return {
    key,
    keyLabel: key,
    operator,
    value: '',
  };
};

describe('tagValuesFilterAdHocFilters', () => {
  test('Should return empty: Single existing value for same label', () => {
    // Single existing value for same label
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '1',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '1',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexEqual)
      )
    ).toEqual([]);
  });
  test('Should return empty:  Multiple existing values for same label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.Equal, value: '1' },
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.Equal, value: '1' },
          {
            key: 'env',
            operator: LabelFilterOp.Equal,
            value: '2',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexEqual)
      )
    ).toEqual([]);
  });
  test('Should return empty: Regex value for same label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          { key: 'env', operator: LabelFilterOp.RegexEqual, value: '1|2' },
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '3|4',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2|.+',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([]);
  });
  test('Existing filter for same label, but adding negative filter', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.NotEqual)
      )
    ).toEqual([
      {
        key: 'env',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.RegexNotEqual)
      )
    ).toEqual([
      {
        key: 'env',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
  test('Contains filter for another label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'service_name',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([
      {
        key: 'service_name',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
  test('Contains filter for same label, and another label', () => {
    expect(
      tagValuesFilterAdHocFilters(
        [
          {
            key: 'service_name',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
          {
            key: 'env',
            operator: LabelFilterOp.RegexEqual,
            value: '1|2',
          },
        ],
        getNewFilter('env', LabelFilterOp.Equal)
      )
    ).toEqual([
      {
        key: 'service_name',
        operator: LabelFilterOp.RegexEqual,
        value: '1|2',
      },
    ]);
  });
});
