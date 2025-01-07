import { css } from '@emotion/css';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, InlineField, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
import { getLogOption, LogsVisualizationType, setLogOption } from 'services/store';
import { LogsListScene } from './LogsListScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';
import { LogsPanelScene } from './LogsPanelScene';
import { locationService } from '@grafana/runtime';
import { narrowLogsSortOrder } from '../../services/narrowing';
import { logger } from '../../services/logger';

interface LogOptionsState extends SceneObjectState {
  visualizationType: LogsVisualizationType;
  onChangeVisualizationType: (type: LogsVisualizationType) => void;
}

/**
 * The options rendered in the logs panel header
 */
export class LogOptionsScene extends SceneObjectBase<LogOptionsState> {
  static Component = LogOptionsRenderer;

  constructor(state: LogOptionsState) {
    super({
      ...state,
    });
  }

  handleWrapLinesChange = (type: boolean) => {
    this.getLogsPanelScene().setState({ wrapLogMessage: type });
    setLogOption('wrapLogMessage', type);
    this.getLogsListScene().setLogsVizOption({ wrapLogMessage: type });
    this.getLogsListScene().setLogsVizOption({ prettifyLogMessage: type });
  };

  onChangeLogsSortOrder = (sortOrder: LogsSortOrder) => {
    this.getLogsPanelScene().setState({ sortOrder: sortOrder });
    setLogOption('sortOrder', sortOrder);
    this.getLogsListScene().setLogsVizOption({ sortOrder: sortOrder });
  };

  getLogsListScene = () => {
    return sceneGraph.getAncestor(this, LogsListScene);
  };

  getLogsPanelScene = () => {
    return sceneGraph.getAncestor(this, LogsPanelScene);
  };

  clearDisplayedFields = () => {
    const parentScene = this.getLogsListScene();
    parentScene.clearDisplayedFields();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_clear_displayed_fields
    );
  };
}

function LogOptionsRenderer({ model }: SceneComponentProps<LogOptionsScene>) {
  const { onChangeVisualizationType, visualizationType } = model.useState();
  const { wrapLogMessage, sortOrder } = model.getLogsPanelScene().useState();
  const { displayedFields } = model.getLogsListScene().useState();
  const styles = useStyles2(getStyles);
  const wrapLines = wrapLogMessage ?? false;

  return (
    <div className={styles.container}>
      {displayedFields.length > 0 && (
        <Tooltip content={`Clear displayed fields: ${displayedFields.join(', ')}`}>
          <Button size={'sm'} variant="secondary" fill="outline" onClick={model.clearDisplayedFields}>
            Show original log line
          </Button>
        </Tooltip>
      )}
      <InlineField className={styles.buttonGroupWrapper} transparent>
        <RadioButtonGroup
          size="sm"
          options={[
            {
              label: 'Newest first',
              value: LogsSortOrder.Descending,
              description: 'Show results newest to oldest',
            },
            {
              label: 'Oldest first',
              value: LogsSortOrder.Ascending,
              description: 'Show results oldest to newest',
            },
          ]}
          value={sortOrder}
          onChange={model.onChangeLogsSortOrder}
        />
      </InlineField>

      <InlineField className={styles.buttonGroupWrapper} transparent>
        <RadioButtonGroup
          size="sm"
          value={wrapLines}
          onChange={model.handleWrapLinesChange}
          options={[
            {
              label: 'Wrap',
              value: true,
              description: 'Enable wrapping of long log lines',
            },
            {
              label: 'No wrap',
              value: false,
              description: 'Disable wrapping of long log lines',
            },
          ]}
        />
      </InlineField>
      <LogsPanelHeaderActions vizType={visualizationType} onChange={onChangeVisualizationType} />
    </div>
  );
}

export function getLogsPanelSortOrderFromStore() {
  return getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending) as LogsSortOrder;
}

export function getLogsPanelSortOrderFromURL() {
  // Since sort order is used to execute queries before the logs panel is instantiated, the scene url state will never influence the query
  // Hacking this for now to manually check the URL search params to override local storage state if set
  const location = locationService.getLocation();
  const search = new URLSearchParams(location.search);
  const sortOrder = search.get('sortOrder');

  try {
    if (typeof sortOrder === 'string') {
      const decodedSortOrder = narrowLogsSortOrder(JSON.parse(sortOrder));
      if (decodedSortOrder) {
        return decodedSortOrder;
      }
    }
  } catch (e) {
    // URL Params can be manually changed and it will make JSON.parse() fail.
    logger.error(e, { msg: 'LogOptionsScene(getLogsPanelSortOrderFromURL): unable to parse sortOrder' });
  }

  return false;
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  }),
  buttonGroupWrapper: css({
    margin: 0,
    alignItems: 'center',
  }),
});
