import { AppPlugin } from '@grafana/data';
import { App } from 'Components/App';
import init from '@bsull/augurs';

// eslint-disable-next-line no-console
init().then(() => console.debug('Grafana ML initialized'));

export const plugin = new AppPlugin<{}>().setRootPage(App);
