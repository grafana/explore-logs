import { GrotError } from '../../GrotError';
import { Alert, Button } from '@grafana/ui';
import React from 'react';
import { css } from '@emotion/css';
import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneVariable,
} from '@grafana/scenes';
import { IndexScene } from '../../IndexScene/IndexScene';
import { SERVICE_NAME } from '../../ServiceSelectionScene/ServiceSelectionScene';
import { CustomConstantVariable } from '../../../services/CustomConstantVariable';

interface ClearVariablesSceneState extends SceneObjectState {
  fieldsOnly?: boolean;
}
export class ClearVariablesScene extends SceneObjectBase<ClearVariablesSceneState> {
  private static getVariablesToClear(indexSceneChild: SceneObject): SceneVariable[] {
    const indexScene = sceneGraph.getAncestor(indexSceneChild, IndexScene);
    const variables = sceneGraph.getVariables(indexScene);
    const variablesToClear: SceneVariable[] = [];

    for (const variable of variables.state.variables) {
      if (variable instanceof CustomConstantVariable && variable.state.value && variable.state.name !== 'logsFormat') {
        variablesToClear.push(variable);
      }
    }

    const fieldsToClear = ClearVariablesScene.getFieldsToClear(indexSceneChild);
    return [...variablesToClear, ...fieldsToClear];
  }

  private static getFieldsToClear(indexSceneChild: SceneObject): SceneVariable[] {
    const indexScene = sceneGraph.getAncestor(indexSceneChild, IndexScene);
    const variables = sceneGraph.getVariables(indexScene);
    const variablesToClear: SceneVariable[] = [];

    for (const variable of variables.state.variables) {
      if (
        variable instanceof AdHocFiltersVariable &&
        variable.state.filters.filter((filter) => filter.key !== SERVICE_NAME).length
      ) {
        variablesToClear.push(variable);
      }
    }

    return variablesToClear;
  }

  public static getCountOfFieldsToClear(indexSceneChild: SceneObject): number {
    return ClearVariablesScene.getFieldsToClear(indexSceneChild).length;
  }

  public static getCountOfVariablesToClear(indexSceneChild: SceneObject): number {
    const variables = ClearVariablesScene.getVariablesToClear(indexSceneChild);
    return variables.length;
  }

  private clearVariables(variablesToClear: SceneVariable[]) {
    // clear patterns: needs to happen first, or it won't work as patterns is split into a variable and a state, and updating the variable triggers a state update
    const indexScene = sceneGraph.getAncestor(this, IndexScene);
    indexScene.setState({
      patterns: [],
    });

    variablesToClear.forEach((variable) => {
      if (variable instanceof AdHocFiltersVariable && variable.state.key === 'adhoc_service_filter') {
        variable.setState({
          filters: variable.state.filters.filter((filter) => filter.key === SERVICE_NAME),
        });
      } else if (variable instanceof AdHocFiltersVariable) {
        variable.setState({
          filters: [],
        });
      } else if (variable instanceof CustomConstantVariable) {
        variable.setState({
          value: '',
          text: '',
        });
      }
    });
  }

  public static Component({ model }: SceneComponentProps<ClearVariablesScene>): React.ReactElement | null {
    const { fieldsOnly } = model.useState();
    const variablesToClear = fieldsOnly
      ? ClearVariablesScene.getFieldsToClear(model)
      : ClearVariablesScene.getVariablesToClear(model);
    return (
      <GrotError>
        <Alert title="" severity="info">
          No labels match these filters.{' '}
          <Button className={styles.button} onClick={() => model.clearVariables(variablesToClear)}>
            Clear filters
          </Button>{' '}
        </Alert>
      </GrotError>
    );
  }
}

const styles = {
  button: css({
    marginLeft: '1.5rem',
  }),
};
