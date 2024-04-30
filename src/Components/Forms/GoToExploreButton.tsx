import React from 'react';

import { toURLRange, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { IndexScene } from 'Components/Index/IndexScene';
import { VAR_LOGS_FORMAT_EXPR } from 'services/variables';
import { getDataSource, getQueryExpr } from 'services/scenes';
import { testIds } from 'Components/testIds';
interface ShareExplorationButtonState {
  exploration: IndexScene;
}

export const GoToExploreButton = ({ exploration }: ShareExplorationButtonState) => {
  const onClick = () => {
    const datasource = getDataSource(exploration);
    const expr = getQueryExpr(exploration).replace(VAR_LOGS_FORMAT_EXPR, '').replace(/\s+/g, ' ').trimEnd();
    const timeRange = sceneGraph.getTimeRange(exploration).state.value;
    const exploreState = JSON.stringify({
      ['loki-explore']: {
        range: toURLRange(timeRange.raw),
        queries: [{ refId: 'logs', expr, datasource }],
        datasource,
      },
    });
    const subUrl = config.appSubUrl ?? '';
    const link = urlUtil.renderUrl(`${subUrl}/explore`, { panes: exploreState, schemaVersion: 1 });
    window.open(link, '_blank');
  };

  return (
    <ToolbarButton
      data-testid={testIds.exploreServiceBreakdown.openExplore}
      variant={'canvas'}
      icon={'compass'}
      onClick={onClick}
    >
      Open in Explore
    </ToolbarButton>
  );
};
