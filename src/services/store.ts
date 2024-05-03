import pluginJson from '../plugin.json';

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
    console.error('Error parsing favorite services from local storage', e);
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
    console.error('Error parsing favorite services from local storage', e);
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
