import { PanelBuilders } from '@grafana/scenes';
import { LogsPanelHeaderActions, VizTypeProps } from '@/components/Explore/panels/tablePanel';
import React from 'react';

export function getLogsPanel(vizTypeProps: VizTypeProps) {
  return PanelBuilders.logs()
    .setTitle('Logs')
    .setOption('showLogContextToggle', true)
    .setOption('showTime', true)
    .setHeaderActions(<LogsPanelHeaderActions vizType={vizTypeProps.vizType} onChange={vizTypeProps.setVizType} />)
    .build();
}
