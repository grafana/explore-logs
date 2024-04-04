import { PanelBuilders } from '@grafana/scenes';

export function getLogsPanel() {
  return PanelBuilders.logs().setTitle('Logs').setOption('showLogContextToggle', true).build();
}
