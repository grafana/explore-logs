import { AppPlugin } from '@grafana/data';
import { App } from 'Components/App';
import { linkConfigs } from 'services/extensions/links';
import { init as initRuntimeDs } from 'services/datasource';

export const plugin = new AppPlugin<{}>().setRootPage(App);

for (const linkConfig of linkConfigs) {
  plugin.configureExtensionLink(linkConfig);
}

initRuntimeDs();
