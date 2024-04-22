import { AppPlugin } from '@grafana/data';
import { App } from 'Components/App';

export const plugin = new AppPlugin<{}>().setRootPage(App);
