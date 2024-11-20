import pluginJson from '../plugin.json';
import { SortBy, SortDirection } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { sceneGraph, SceneObject } from '@grafana/scenes';
import { getDataSourceName, getDataSourceVariable, getServiceName } from './variableGetters';
import { logger } from './logger';
import { SERVICE_NAME } from './variables';
import { FavoriteServiceHeaderActionScene } from '../Components/ServiceSelectionScene/FavoriteServiceHeaderActionScene';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { ServiceSelectionScene } from '../Components/ServiceSelectionScene/ServiceSelectionScene';

const FAVORITE_PRIMARY_LABEL_VALUES_LOCALSTORAGE_KEY = `${pluginJson.id}.services.favorite`;
const FAVORITE_PRIMARY_LABEL_NAME_LOCALSTORAGE_KEY = `${pluginJson.id}.primarylabels.tabs.favorite`;
const DS_LOCALSTORAGE_KEY = `${pluginJson.id}.datasource`;

// This should be a string, but we'll accept anything and return an empty array if it's not a string
export function getFavoriteLabelValuesFromStorage(dsKey: string | unknown, labelName: string): string[] {
  if (!dsKey || typeof dsKey !== 'string') {
    return [];
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let labelValues = [];
  try {
    labelValues = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(labelValues)) {
    labelValues = [];
  }
  return labelValues;
}

function rerenderFavorites(sceneRef: SceneObject) {
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

// This should be a string, but we'll accept anything and return early
export function addToFavoriteLabelValueInStorage(dsKey: string | unknown, labelName: string, labelValue: string) {
  if (!dsKey || typeof dsKey !== 'string') {
    return;
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let services = [];
  try {
    services = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }

  // We want to put this service at the top of the list and remove any duplicates
  const servicesToStore = services.filter((service: string) => service !== labelValue);
  servicesToStore.unshift(labelValue);

  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function removeFromFavoritesInStorage(dsKey: string | unknown, labelName: string, labelValue: string) {
  if (!dsKey || !labelName || !labelValue || typeof dsKey !== 'string') {
    return;
  }
  const key = createPrimaryLabelLocalStorageKey(dsKey, labelName);
  let services = [];
  try {
    services = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }
  const servicesToStore = services.filter((service: string) => service !== labelValue);
  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function addTabToLocalStorage(dsKey: string, labelName: string) {
  if (!dsKey || !labelName) {
    return;
  }

  const key = createTabsLocalStorageKey(dsKey);

  let services = [];
  try {
    services = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing saved tabs from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }

  if (services.indexOf(labelName) === -1) {
    // We want to put this service at the top of the list and remove any duplicates
    const servicesToStore = services.filter((tabName: string) => tabName !== labelName);
    servicesToStore.unshift(labelName);

    localStorage.setItem(key, JSON.stringify(servicesToStore));
  }
}

export function removeTabFromLocalStorage(dsKey: string, labelName: string) {
  if (!dsKey || !labelName) {
    return;
  }
  const key = createTabsLocalStorageKey(dsKey);
  let services = [];
  try {
    services = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }
  const servicesToStore = services.filter((tabName: string) => tabName !== labelName);
  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

export function getFavoriteTabsFromStorage(dsKey: string | unknown): string[] {
  if (!dsKey || typeof dsKey !== 'string') {
    return [];
  }
  const key = createTabsLocalStorageKey(dsKey);
  let tabNames = [];
  try {
    tabNames = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(tabNames)) {
    tabNames = [];
  }
  return tabNames;
}

function createPrimaryLabelLocalStorageKey(ds: string, labelName: string) {
  if (labelName === SERVICE_NAME) {
    labelName = '';
  } else {
    labelName = `_${labelName}`;
  }
  return `${FAVORITE_PRIMARY_LABEL_VALUES_LOCALSTORAGE_KEY}_${ds}${labelName}`;
}

function createTabsLocalStorageKey(ds: string) {
  return `${FAVORITE_PRIMARY_LABEL_NAME_LOCALSTORAGE_KEY}_${ds}`;
}

export function getLastUsedDataSourceFromStorage(): string | undefined {
  return localStorage.getItem(DS_LOCALSTORAGE_KEY) ?? undefined;
}

export function addLastUsedDataSourceToStorage(dsKey: string) {
  localStorage.setItem(DS_LOCALSTORAGE_KEY, dsKey);
}

const SORT_BY_LOCALSTORAGE_KEY = `${pluginJson.id}.values.sort`;
export function getSortByPreference(
  target: string,
  defaultSortBy: SortBy,
  defaultDirection: SortDirection
): { sortBy: SortBy | ''; direction: SortDirection } {
  const preference = localStorage.getItem(`${SORT_BY_LOCALSTORAGE_KEY}.${target}.by`) ?? '';
  const parts = preference.split('.');
  if (!parts[0] || !parts[1]) {
    return { sortBy: defaultSortBy, direction: defaultDirection };
  }
  const sortBy = parts[0] as SortBy;
  const direction = parts[1] as SortDirection;
  return { sortBy, direction };
}

export function setSortByPreference(target: string, sortBy: string, direction: string) {
  // Prevent storing empty values
  if (sortBy && direction) {
    localStorage.setItem(`${SORT_BY_LOCALSTORAGE_KEY}.${target}.by`, `${sortBy}.${direction}`);
  }
}

const LOG_OPTIONS_LOCALSTORAGE_KEY = `${pluginJson.id}.logs.option`;
export type LogOption = 'wrapLines';
export function getLogOption(option: LogOption) {
  return localStorage.getItem(`${LOG_OPTIONS_LOCALSTORAGE_KEY}.${option}`);
}

export function setLogOption(option: LogOption, value: string | number | boolean) {
  let storedValue = value.toString();
  if (typeof value === 'boolean' && !value) {
    storedValue = '';
  }
  localStorage.setItem(`${LOG_OPTIONS_LOCALSTORAGE_KEY}.${option}`, storedValue);
}

function getExplorationPrefix(sceneRef: SceneObject) {
  const ds = getDataSourceName(sceneRef);
  const serviceName = getServiceName(sceneRef);
  return `${ds}.${serviceName}`;
}

export function getDisplayedFields(sceneRef: SceneObject) {
  const PREFIX = getExplorationPrefix(sceneRef);
  const storedFields = localStorage.getItem(`${pluginJson.id}.${PREFIX}.logs.fields`);
  if (storedFields) {
    return JSON.parse(storedFields);
  }
  return [];
}

export function setDisplayedFields(sceneRef: SceneObject, fields: string[]) {
  const PREFIX = getExplorationPrefix(sceneRef);
  localStorage.setItem(`${pluginJson.id}.${PREFIX}.logs.fields`, JSON.stringify(fields));
}

export type LogsVisualizationType = 'logs' | 'table';

const VISUALIZATION_TYPE_LOCALSTORAGE_KEY = 'grafana.explore.logs.visualisationType';
export function getLogsVisualizationType(): LogsVisualizationType {
  const storedType = localStorage.getItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY) ?? '';
  switch (storedType) {
    case 'table':
    case 'logs':
      return storedType;
    default:
      return 'logs';
  }
}

export function setLogsVisualizationType(type: string) {
  localStorage.setItem(VISUALIZATION_TYPE_LOCALSTORAGE_KEY, type);
}
