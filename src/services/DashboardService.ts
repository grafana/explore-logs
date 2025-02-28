import { getBackendSrv, locationService } from '@grafana/runtime';
import { sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';
import { IndexScene } from '../Components/IndexScene/IndexScene';
import { getQueryRunnerFromChildren } from './scenes';
import { DataSourceRef, DashboardLink } from '@grafana/schema';
import { LokiQuery } from './lokiQuery';

export async function createDashboard(panel: VizPanel) {
  console.log('createDashboard', {
    panel,
  });

  const location = locationService.getLocation();
  const currentUrl = location.pathname + location.search;

  const indexScene = sceneGraph.getAncestor(panel, IndexScene);
  const dataSource: DataSourceRef = { uid: indexScene.state.ds?.uid };

  const timeRange = sceneGraph.getTimeRange(panel).state.value;

  const $data = sceneGraph.getData(panel);
  const queryRunner = $data instanceof SceneQueryRunner ? $data : getQueryRunnerFromChildren($data)[0];
  const queries = queryRunner.state.queries as LokiQuery[];

  const panelLink: DashboardLink = {
    asDropdown: false,
    icon: '',
    includeVars: false,
    keepTime: true,
    tags: [],
    tooltip: '',
    title: 'Open original Logs Drilldown link',
    url: currentUrl,
    targetBlank: true,
    type: 'link',
  };

  // Doesn't look like types are exported from core?
  const dashboardPanel = {
    id: 2,
    title: panel.state.title,

    // type: 'logs',
    description: undefined, // Remove description since we're moving it to its own panel
    links: [panelLink],
    datasource: dataSource,
    targets: queries.map((q) => ({
      ...q,
      expr: sceneGraph.interpolate(panel, q.expr),
    })),
  };

  // Create dashboard JSON
  const dashboard = {
    title: `${panel.state.title} - Dashboard`,
    panels: [
      // Map the collectables to panels, starting after the header
      dashboardPanel,
    ],
    time: {
      from: timeRange.from,
      to: timeRange.to,
    },
  };

  console.log('dashboard', dashboard);

  // Create the dashboard via Grafana API
  const response = await getBackendSrv().post<SaveDashboardResponseDTO>('/api/dashboards/db/', {
    dashboard,
  });

  if (!response.url) {
    throw new Error('Failed to create dashboard');
  }

  window.open(response.url, '_blank');
}

export interface SaveDashboardResponseDTO {
  id: number;
  slug: string;
  status: string;
  uid: string;
  url: string;
  version: number;
}
