import { lazy } from 'react';
import { AppPlugin } from '@grafana/data';

const App = lazy(async () => {
  const { wasmSupported } = await import('services/sorting');
  const { linkConfigs } = await import('services/extensions/links');
  const { default: initRuntimeDs } = await import('services/datasource');
  const { default: init } = await import('@bsull/augurs');

  initRuntimeDs();

  for (const linkConfig of linkConfigs) {
    plugin.configureExtensionLink(linkConfig);
  }

  if (wasmSupported()) {
    await init();
  }

  return import('Components/App');
});

export const plugin = new AppPlugin<{}>().setRootPage(App);
