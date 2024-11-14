import React from 'react';

import { toURLRange, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { getDataSource, getQueryExpr } from 'services/scenes';
import { testIds } from 'services/testIds';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
interface GoToExploreButtonState {
  exploration: IndexScene;
}

export const GoToExploreButton = ({ exploration }: GoToExploreButtonState) => {
  const onClick = () => {
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.open_in_explore_clicked
    );
    onExploreLinkClick(exploration);
  };

  return (
    <ToolbarButton
      data-testid={testIds.exploreServiceDetails.openExplore}
      variant={'canvas'}
      icon={'compass'}
      onClick={onClick}
    >
      Open in Explore
    </ToolbarButton>
  );
};

export const onExploreLinkClick = (indexScene: IndexScene, expr?: string) => {
  const datasource = getDataSource(indexScene);
  if (!expr) {
    expr = getQueryExpr(indexScene);
  }

  expr = expr.replace(/\s+/g, ' ').trimEnd();

  const timeRange = sceneGraph.getTimeRange(indexScene).state.value;
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
