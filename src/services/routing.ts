import pluginJson from '../plugin.json';

export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

export enum ROUTES {
  Explore = 'explore',
  Logs = 'logs',
}

export const EXPLORATIONS_ROUTE = `${PLUGIN_BASE_URL}/${ROUTES.Explore}`;

// Prefixes the route with the base URL of the plugin
export function prefixRoute(route: string): string {
  return `${PLUGIN_BASE_URL}/${route}`;
}
