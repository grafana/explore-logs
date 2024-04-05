import { AppPlugin } from '@grafana/data';
import { App } from './components/App';
import { AppConfig } from './components/AppConfig';
import { linkConfigs } from 'extensions/links';

export const plugin = new AppPlugin<{}>().setRootPage(App).addConfigPage({
  title: 'Configuration',
  icon: 'cog',
  body: AppConfig,
  id: 'configuration',
});



for (const linkConfig of linkConfigs) {
  plugin.configureExtensionLink(linkConfig);
}