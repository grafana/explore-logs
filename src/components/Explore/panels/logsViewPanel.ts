import { PanelBuilders, SceneQueryRunner } from '@grafana/scenes';
import { explorationDS } from '../../../utils/shared';

export function getLogViewPanel(logId: string) {
  return PanelBuilders.logs()
    .setTitle('Log')
    .setData(
      new SceneQueryRunner({
        datasource: explorationDS,
        queries: [{ refId: 'A', query: logId, queryType: 'logql' }],
      })
    )
    .build();
}
