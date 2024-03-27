import React from 'react';

import { ToolbarButton } from '@grafana/ui';

import { LogExploration } from '../../../pages/Explore';
import { getDataSource, getQueryExpr } from '../../../utils/utils';
import { sceneGraph } from '@grafana/scenes';
import { toURLRange, urlUtil } from '@grafana/data';
import { VAR_LOGS_FORMAT_EXPR } from 'utils/shared';

interface ShareExplorationButtonState {
  exploration: LogExploration;
}

export const GoToExploreButton = ({ exploration }: ShareExplorationButtonState) => {
  const onClick = () => {
    const datasource = getDataSource(exploration)
    const expr = getQueryExpr(exploration).replace(VAR_LOGS_FORMAT_EXPR, '')
    const timeRange = sceneGraph.getTimeRange(exploration).state.value
    const exploreState = JSON.stringify({
      ['loki-explore']: { range: toURLRange(timeRange.raw), queries: [{refId: 'logs',expr, datasource}], datasource}
    })
    const link = urlUtil.renderUrl('/explore', { panes: exploreState, schemaVersion: 1 });
    window.open(link, '_blank');
  };

  return <ToolbarButton variant={'canvas'} icon={'compass'} onClick={onClick}>Open in Explore</ToolbarButton>;
};
