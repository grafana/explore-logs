import { css } from '@emotion/css';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, InlineField, RadioButtonGroup, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
import { getLogOption, LogsVisualizationType, setLogOption } from 'services/store';
import { LogsListScene } from './LogsListScene';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { GrafanaTheme2, LogsSortOrder } from '@grafana/data';

interface LogOptionsState extends SceneObjectState {
  wrapLogMessage?: boolean;
  visualizationType: LogsVisualizationType;
  onChangeVisualizationType: (type: LogsVisualizationType) => void;
  sortOrder?: LogsSortOrder;
}

/**
 * The options rendered in the logs panel header
 */
export class LogOptionsScene extends SceneObjectBase<LogOptionsState> {
  static Component = LogOptionsRenderer;

  constructor(state: LogOptionsState) {
    super({
      ...state,
      sortOrder: getLogsPanelSortOrder(),
      wrapLogMessage: Boolean(getLogOption<boolean>('wrapLogMessage', false)),
    });
  }

  handleWrapLinesChange = (type: 'wrap' | 'nowrap') => {
    this.setState({ wrapLogMessage: type === 'wrap' });
    setLogOption('wrapLogMessage', type === 'wrap');
    this.getParentScene().setLogsVizOption({ wrapLogMessage: type === 'wrap' });
  };

  onChangeLogsSortOrder = (sortOrder: LogsSortOrder) => {
    this.setState({ sortOrder: sortOrder });
    setLogOption('sortOrder', sortOrder);
    this.getParentScene().setLogsVizOption({ sortOrder: sortOrder });
  };

  getParentScene = () => {
    return sceneGraph.getAncestor(this, LogsListScene);
  };

  clearDisplayedFields = () => {
    const parentScene = this.getParentScene();
    parentScene.clearDisplayedFields();
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_clear_displayed_fields
    );
  };
}

function LogOptionsRenderer({ model }: SceneComponentProps<LogOptionsScene>) {
  const { wrapLogMessage, onChangeVisualizationType, visualizationType, sortOrder } = model.useState();
  const { displayedFields } = model.getParentScene().useState();
  const styles = useStyles2(getStyles);
  const wrapLinesText = wrapLogMessage ? 'wrap' : 'nowrap';

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
          value={wrapLinesText}
          onChange={model.handleWrapLinesChange}
          options={[
            {
              label: 'Wrap',
              value: 'wrap',
              description: 'Enable wrapping of long log lines',
            },
            {
              label: 'No wrap',
              value: 'nowrap',
              description: 'Disable wrapping of long log lines',
            },
          ]}
        />
      </InlineField>
      <LogsPanelHeaderActions vizType={visualizationType} onChange={onChangeVisualizationType} />
    </div>
  );
}

export function getLogsPanelSortOrder() {
  return getLogOption<LogsSortOrder>('sortOrder', LogsSortOrder.Descending) as LogsSortOrder;
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
