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
  constructor(public criteria: string, public direction: string) {
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
    this.setState({ sortBy: criteria[0] });
    setSortByPreference(this.state.target, criteria[0], this.state.direction);
    //this.publishEvent(new SortCriteriaChanged(criteria.value, ''), true);
  };

  public onDirectionChange = (direction: SelectableValue<string>) => {
    if (!direction.value) {
      return;
    }
    this.setState({ direction: direction.value });
    setSortByPreference(this.state.target, this.state.sortBy, direction.value);
    //this.publishEvent(new SortCriteriaChanged(criteria.value, ''), true);
  };

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { sortBy, direction } = model.useState();
    return (
      <>
        <InlineField>
          <Select
            onChange={model.onDirectionChange}
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
        <InlineField label="Sort by">
          <StatsPicker
            placeholder="Choose criteria"
            stats={[sortBy]}
            allowMultiple={false}
            onChange={model.onCriteriaChange}
            defaultStat={ReducerID.stdDev}
            width={12}
          />
        </InlineField>
      </>
    );
  };
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
