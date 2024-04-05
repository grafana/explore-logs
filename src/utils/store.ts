import { SERVICES_LOCALSTORAGE_KEY } from 'pages/Explore/SelectStartingPointScene';

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
  services.push(serviceName);
  localStorage.setItem(key, JSON.stringify(services));
}

function createServicesLocalStorageKey(ds: string) {
  return `${SERVICES_LOCALSTORAGE_KEY}_${ds}`;
}
