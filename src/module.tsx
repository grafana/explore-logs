import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';
import { linkConfigs } from 'services/extensions/links';

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
  plugin.configureExtensionLink(linkConfig);
}
