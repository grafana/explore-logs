import { AppPlugin } from '@grafana/data';
import { App } from 'Components/App';
import init from '@bsull/augurs';
import { linkConfigs } from 'services/extensions/links';

// eslint-disable-next-line no-console
init().then(() => console.debug('Grafana ML initialized'));

export const plugin = new AppPlugin<{}>().setRootPage(App);

for (const linkConfig of linkConfigs) {
  plugin.configureExtensionLink(linkConfig);
}
