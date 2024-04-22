import pluginJson from '../plugin.json';

const SERVICES_LOCALSTORAGE_KEY = `${pluginJson.id}.services.favorite`;

export function getFavoriteServicesFromStorage(ds: any): string[] {
  if (!ds || typeof ds !== 'string') {
    return [];
  }
  const key = createServicesLocalStorageKey(ds);
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

export function addToFavoriteServicesInStorage(ds: any, serviceName: string) {
  if (!ds || typeof ds !== 'string') {
    return;
  }
  const key = createServicesLocalStorageKey(ds);
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
  const servicesToStore = services.filter((service: string) => service !== serviceName)
  servicesToStore.unshift(serviceName);

  localStorage.setItem(key, JSON.stringify(servicesToStore));
}

function createServicesLocalStorageKey(ds: string) {
  return `${SERVICES_LOCALSTORAGE_KEY}_${ds}`;
}
