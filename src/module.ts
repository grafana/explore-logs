import { AppPlugin } from '@grafana/data';
import { App } from 'Components/App';
import { ExposedLogExplorationPage } from 'Components/ExposedLogExplorationPage/v1/ExposedLogExplorationPage';
import pluginJson from 'plugin.json';

export const plugin = new AppPlugin<{}>().setRootPage(App);

if (plugin.exposeComponent) {
  plugin.exposeComponent({
    id: `${pluginJson.id}/explore-logs/v1`,
    component: ExposedLogExplorationPage,
    title: 'Explore logs view',
    description: 'Explore logs service details view for grafana plugins to consume.',
  });
}
