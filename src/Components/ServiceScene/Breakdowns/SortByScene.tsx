import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { BusEventBase, DataFrame, ReducerID, SelectableValue } from '@grafana/data';
import { getLabelValueFromDataFrame } from 'services/levels';
import { InlineField, Select, StatsPicker } from '@grafana/ui';
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
  constructor(state: Pick<SortBySceneState, 'target'>) {
    const { sortBy, direction } = getSortByPreference(state.target, ReducerID.stdDev, 'desc');
    super({
      target: state.target,
      sortBy,
      direction,
    });
  }

  public onCriteriaChange = (criteria: string[]) => {
    if (!criteria.length) {
      return;
    }
    this.setState({ sortBy: criteria[0] });
    setSortByPreference(this.state.target, criteria[0], this.state.direction);
    this.publishEvent(new SortCriteriaChanged(criteria[0], this.state.direction), true);
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
          <StatsPicker
            placeholder="Choose criteria"
            stats={[sortBy]}
            allowMultiple={false}
            onChange={model.onCriteriaChange}
            defaultStat={ReducerID.stdDev}
            width={18}
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
