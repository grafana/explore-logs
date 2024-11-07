import pluginJson from '../plugin.json';

// jest tests struggle with import order when importing from the plugin.json, moving methods that use the plugin_id to its own file makes it simpler to import when mocking
export const PLUGIN_ID = pluginJson.id;
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

// Prefixes the route with the base URL of the plugin
export function prefixRoute(route: string): string {
  return `${PLUGIN_BASE_URL}/${route}`;
}
