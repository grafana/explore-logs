import pluginJson from '../plugin.json';
import { SortBy, SortDirection } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { SceneObject } from '@grafana/scenes';
import { getDataSourceName, getServiceName } from './variableGetters';
import { logger } from './logger';

const SERVICES_LOCALSTORAGE_KEY = `${pluginJson.id}.services.favorite`;
const DS_LOCALSTORAGE_KEY = `${pluginJson.id}.datasource`;

// This should be a string, but we'll accept anything and return an empty array if it's not a string
export function getFavoriteServicesFromStorage(dsKey: string | unknown): string[] {
  if (!dsKey || typeof dsKey !== 'string') {
    return [];
  }
  const key = createServicesLocalStorageKey(dsKey);
  let services = [];
  try {
    services = JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    logger.error(e, { msg: 'Error parsing favorite services from local storage' });
  }

  if (!Array.isArray(services)) {
    services = [];
  }
  return services;
}

// This should be a string, but we'll accept anything and return early
export function addToFavoriteServicesInStorage(dsKey: string | unknown, serviceName: string) {
  if (!dsKey || typeof dsKey !== 'string') {
    return;
  }
  const key = createServicesLocalStorageKey(dsKey);
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
  const servicesToStore = services.filter((service: string) => service !== serviceName);
  servicesToStore.unshift(serviceName);

  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

function createServicesLocalStorageKey(ds: string) {
  return `${SERVICES_LOCALSTORAGE_KEY}_${ds}`;
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
