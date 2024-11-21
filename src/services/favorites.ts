import { sceneGraph, SceneObject } from '@grafana/scenes';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { FavoriteServiceHeaderActionScene } from '../Components/ServiceSelectionScene/FavoriteServiceHeaderActionScene';
import { ServiceSelectionScene } from '../Components/ServiceSelectionScene/ServiceSelectionScene';
import { getDataSourceVariable } from './variableGetters';
import { addToFavoriteLabelValueInStorage, removeFromFavoritesInStorage } from './store';

export function rerenderFavorites(sceneRef: SceneObject) {
  // Find all FavoriteServiceHeaderActionScene and re-render
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const favoriteServiceHeaderActionScene = sceneGraph.findAllObjects(
    indexScene,
    (o) => o instanceof FavoriteServiceHeaderActionScene
  );
  favoriteServiceHeaderActionScene.forEach((s) => s.forceRender());

  // Find the ServiceFieldSelector's parent (currently service selection scene) and force re-render so dropdown has correct order
  // @todo move ServiceFieldSelector to new scene
  const serviceSelectionScene = sceneGraph.findDescendents(indexScene, ServiceSelectionScene);
  serviceSelectionScene.forEach((s) => s.forceRender());
}

export function addToFavorites(labelName: string, labelValue: string, sceneRef: SceneObject) {
  const ds = getDataSourceVariable(sceneRef).getValue();
  addToFavoriteLabelValueInStorage(ds, labelName, labelValue);
  rerenderFavorites(sceneRef);
}

export function removeFromFavorites(labelName: string, labelValue: string, sceneRef: SceneObject) {
  const ds = getDataSourceVariable(sceneRef).getValue();
  removeFromFavoritesInStorage(ds, labelName, labelValue);
  rerenderFavorites(sceneRef);
}
