import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { BusEventBase, DataFrame, ReducerID, SelectableValue, fieldReducers } from '@grafana/data';
import { getLabelValueFromDataFrame } from 'services/levels';
import { InlineField, Select } from '@grafana/ui';
import { getSortByPreference, setSortByPreference } from 'services/store';

export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  sortBy: string;
  direction: string;
}

export class SortCriteriaChanged extends BusEventBase {
  constructor(public sortBy: string, public direction: string) {
    super();
  }
  public static type = 'sort-criteria-changed';
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  public sortingOptions = [
    {
      value: 'changepoint',
      label: 'Auto',
      description: 'Best-effort identification of the most relevant time series',
    },
    {
      value: ReducerID.stdDev,
      label: 'Standard deviation',
      description: 'Standard deviation of all values in a field',
    },
    ...fieldReducers.selectOptions([], (ext) => ext.id !== ReducerID.stdDev).options,
  ];

  constructor(state: Pick<SortBySceneState, 'target'>) {
    const { sortBy, direction } = getSortByPreference(state.target, 'changepoint', 'desc');
    super({
      target: state.target,
      sortBy,
      direction,
    });
  }

  public onCriteriaChange = (criteria: SelectableValue<string>) => {
    if (!criteria.value) {
      return;
    }
    this.setState({ sortBy: criteria.value });
    setSortByPreference(this.state.target, criteria.value, this.state.direction);
    this.publishEvent(new SortCriteriaChanged(criteria.value, this.state.direction), true);
  };

  public onDirectionChange = (direction: SelectableValue<string>) => {
    if (!direction.value) {
      return;
    }
    this.setState({ direction: direction.value });
    setSortByPreference(this.state.target, this.state.sortBy, direction.value);
    this.publishEvent(new SortCriteriaChanged(this.state.sortBy, direction.value), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { sortBy, direction } = model.useState();
    const value = model.sortingOptions.find(({ value }) => value === sortBy);
    return (
      <>
        <InlineField>
          <Select
            onChange={model.onDirectionChange}
            aria-label="Sort direction"
            placeholder=""
            value={direction}
            options={[
              {
                label: 'Asc',
                value: 'asc',
              },
              {
                label: 'Desc',
                value: 'desc',
              },
            ]}
          ></Select>
        </InlineField>
        <InlineField
          label="Sort by"
          htmlFor="sort-by-criteria"
          tooltip="Calculate a derived quantity from the values in your time series and sort by this criteria. Defaults to standard deviation."
        >
          <Select
            value={value}
            width={18}
            isSearchable={true}
            options={model.sortingOptions}
            placeholder={'Choose criteria'}
            onChange={model.onCriteriaChange}
            inputId="sort-by-criteria"
          />
        </InlineField>
      </>
    );
  };
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
