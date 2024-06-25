import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { DataFrame, SelectableValue } from '@grafana/data';
import { getLabelValueFromDataFrame } from 'services/levels';
import { InlineField, Select } from '@grafana/ui';

export interface SortBySceneState extends SceneObjectState {
  target: 'fields' | 'labels';
  criteria: Array<SelectableValue<string>>;
}

export class SortByScene extends SceneObjectBase<SortBySceneState> {
  constructor(state: Pick<SortBySceneState, 'target'>) {
    super({
      target: state.target,
      criteria: [
        {
          label: 'Variability',
          value: 'stdDev',
        },
        {
          label: 'Max values',
          value: 'max',
        },
        {
          label: 'Mean',
          value: 'mean',
        },
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<SortByScene>) => {
    const { criteria } = model.useState();
    return (
      <>
        <InlineField>
          <Select
            onChange={() => {}}
            placeholder=""
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
          <Select onChange={() => {}} options={criteria}></Select>
        </InlineField>
      </>
    );
  };
}

export function getLabelValue(frame: DataFrame) {
  return getLabelValueFromDataFrame(frame) ?? 'No labels';
}
