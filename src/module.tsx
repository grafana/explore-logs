import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';
import { linkConfigs } from 'services/extensions/links';

// Anything imported in this file is included in the main bundle which is pre-loaded in Grafana
// Don't add imports to this file without lazy loading
// Link extensions are the exception as they must be included in the main bundle in order to work in core Grafana
const App = lazy(async () => {
  const { wasmSupported } = await import('services/sorting');

  const { default: initRuntimeDs } = await import('services/datasource');
  const { default: init } = await import('@bsull/augurs');

  initRuntimeDs();

  if (wasmSupported()) {
    await init();
  }

  return import('Components/App');
});

export const plugin = new AppPlugin<{}>().setRootPage(App);

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}
