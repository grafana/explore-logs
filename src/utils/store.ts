import { SERVICES_LOCALSTORAGE_KEY } from "pages/Explore/SelectStartingPointScene";

export function getFavoriteServicesFromStorage(): string[] {
  let services = JSON.parse(localStorage.getItem(SERVICES_LOCALSTORAGE_KEY) || '{}');
  if (typeof services !== 'object') {
    services = {};
  }
  const serviceNames = Object.keys(services).filter((key) => services[key]);
  console.log('serviceNames', serviceNames);
  return serviceNames;
}

export function addToFavoriteServicesInStorage(serviceName: string) {
  let services = JSON.parse(localStorage.getItem(SERVICES_LOCALSTORAGE_KEY) || '{}');
  if (typeof services !== 'object') {
    services = {};
  }
  services[serviceName] = true;
  localStorage.setItem(SERVICES_LOCALSTORAGE_KEY, JSON.stringify(services));
}
