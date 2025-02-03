import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { getLevelsVariable } from '../../services/variableGetters';
import { MetricFindValue } from '@grafana/data';

export interface LevelsVariableSceneState extends SceneObjectState {
  values?: MetricFindValue[];
}
export class LevelsVariableScene extends SceneObjectBase<LevelsVariableSceneState> {
  constructor(state: Partial<LevelsVariableSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    console.log('LevelsVariableScene activation');
    const levelsVar = getLevelsVariable(this);

    // @todo update on labels change
    const levelsKeys = levelsVar?.state?.getTagValuesProvider?.(levelsVar, levelsVar.state.filters[0]);
    levelsKeys?.then((response) => {
      if (Array.isArray(response.values)) {
        this.setState({ values: response.values });
      }

      console.log('levelsKeys', response.values);
    });
  }

  static Component = ({ model }: SceneComponentProps<LevelsVariableScene>) => {
    const { values } = model.useState();
    const levelsVar = getLevelsVariable(model);
    const { filters } = levelsVar.useState();
    console.log('filters', filters);
    console.log('values', values);
    return (
      <div>
        Hello world!
        <div>
          {values?.map((v) => (
            <div key={v.text}>{v.text}</div>
          ))}
        </div>
      </div>
    );
  };
}
