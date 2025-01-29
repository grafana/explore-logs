import React from 'react';

import { toURLRange, urlUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { sceneGraph } from '@grafana/scenes';
import { ToolbarButton } from '@grafana/ui';

import { getDataSource, getQueryExpr } from 'services/scenes';
import { testIds } from 'services/testIds';
import { IndexScene } from 'Components/IndexScene/IndexScene';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { getDisplayedFields, getLogsVisualizationType } from 'services/store';
import { unknownToStrings } from '../../services/narrowing';
import { DATAPLANE_LABELS_NAME } from '../../services/logsFrame';
interface GoToExploreButtonState {
  exploration: IndexScene;
}

export const GoToExploreButton = ({ exploration }: GoToExploreButtonState) => {
  const onClick = () => {
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.open_in_explore_clicked
    );
    onExploreLinkClick(exploration, undefined, true);
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

export const onExploreLinkClick = (indexScene: IndexScene, expr?: string, open = false) => {
  if (!expr) {
    expr = getQueryExpr(indexScene);
  }

  expr = expr.replace(/\s+/g, ' ').trimEnd();

  const datasource = getDataSource(indexScene);
  const timeRange = sceneGraph.getTimeRange(indexScene).state.value;
  const displayedFields = getDisplayedFields(indexScene);
  const visualisationType = getLogsVisualizationType();
  const columns = getUrlColumns();
  const exploreState = JSON.stringify({
    ['loki-explore']: {
      range: toURLRange(timeRange.raw),
      queries: [{ refId: 'logs', expr, datasource }],
      panelsState: {
        logs: {
          displayedFields,
          visualisationType,
          columns,
          labelFieldName: visualisationType === 'table' ? DATAPLANE_LABELS_NAME : undefined,
        },
      },
      datasource,
    },
  });
  const subUrl = config.appSubUrl ?? '';
  const link = urlUtil.renderUrl(`${subUrl}/explore`, { panes: exploreState, schemaVersion: 1 });
  if (open) {
    window.open(link, '_blank');
  }

  return link;
};

function getUrlColumns() {
  const params = new URLSearchParams(window.location.search);
  const urlColumns = params.get('urlColumns');
  if (urlColumns) {
    try {
      const columns = unknownToStrings(JSON.parse(urlColumns));
      let columnsParam: Record<number, string> = {};
      for (const key in columns) {
        columnsParam[key] = columns[key];
      }
      return columnsParam;
    } catch (e) {
      console.error(e);
    }
  }
  return undefined;
}
