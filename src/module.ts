import { AppPlugin } from '@grafana/data';
import { App } from 'App';

export const plugin = new AppPlugin<{}>().setRootPage(App);
