import { VAR_LABELS } from './variables';
import { AdHocFiltersVariable, sceneGraph, SceneObject } from '@grafana/scenes';
import { IndexScene } from '../Components/IndexScene/IndexScene';

/**
 * Helper function to grab the labels variable
 * @param scene
 */
export const getLabelsVariable = (scene: SceneObject) => {
  const indexScene = sceneGraph.getAncestor(scene, IndexScene);
  const variables = sceneGraph.getVariables(indexScene);
  const labelsVariable = variables.state.variables.find((variable) => variable.state.name === VAR_LABELS);

  if (!(labelsVariable instanceof AdHocFiltersVariable)) {
    throw new Error(`${VAR_LABELS} variable not found`);
  }
  return labelsVariable;
};
