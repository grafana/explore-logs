import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Dropdown, Switch, ToolbarButton, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { config } from '@grafana/runtime';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { AGGREGATED_METRIC_START_DATE } from '../ServiceSelectionScene/ServiceSelectionScene';
import pluginJson from '../../plugin.json';
const AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY = `${pluginJson.id}.serviceSelection.aggregatedMetrics`;

export interface ToolbarSceneState extends SceneObjectState {
  isOpen: boolean;
  options: {
    aggregatedMetrics: {
      active: boolean;
      userOverride: boolean;
      disabled: boolean;
    };
  };
}
export class ToolbarScene extends SceneObjectBase<ToolbarSceneState> {
  constructor(state: Partial<ToolbarSceneState>) {
    const userOverride = localStorage.getItem(AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY);
    const active = config.featureToggles.exploreLogsAggregatedMetrics && userOverride !== 'false';

    super({
      isOpen: false,
      options: {
        aggregatedMetrics: {
          active: active ?? false,
          userOverride: userOverride === 'true' ?? false,
          disabled: false,
        },
      },
      ...state,
    });
  }

  public toggleAggregatedMetricsOverride = () => {
    const active = !this.state.options.aggregatedMetrics.active;

    reportAppInteraction(
      USER_EVENTS_PAGES.service_selection,
      USER_EVENTS_ACTIONS.service_selection.aggregated_metrics_toggled,
      {
        enabled: active,
      }
    );

    localStorage.setItem(AGGREGATED_METRICS_USER_OVERRIDE_LOCALSTORAGE_KEY, active.toString());

    this.setState({
      options: {
        aggregatedMetrics: {
          active,
          disabled: this.state.options.aggregatedMetrics.disabled,
          userOverride: active,
        },
      },
    });
  };

  public onToggleOpen = (isOpen: boolean) => {
    this.setState({ isOpen });
  };

  static Component = ({ model }: SceneComponentProps<ToolbarScene>) => {
    const { isOpen, options } = model.useState();
    const styles = useStyles2(getStyles);

    const renderPopover = () => {
      return (
        <div className={styles.popover} onClick={(evt) => evt.stopPropagation()}>
          <div className={styles.heading}>Query options</div>
          <div className={styles.options}>
            <div
              title={
                'Aggregated metrics will return service queries results much more quickly, but with lower resolution'
              }
            >
              Aggregated metrics
            </div>
            <span
              title={
                options.aggregatedMetrics.disabled
                  ? `Aggregated metrics can only be enabled for queries starting after ${AGGREGATED_METRIC_START_DATE.toLocaleString()}`
                  : ''
              }
            >
              <Switch
                value={options.aggregatedMetrics.active}
                disabled={options.aggregatedMetrics.disabled}
                onChange={model.toggleAggregatedMetricsOverride}
              />
            </span>
          </div>
        </div>
      );
    };

    if (options.aggregatedMetrics) {
      return (
        <Dropdown overlay={renderPopover} placement="bottom" onVisibleChange={model.onToggleOpen}>
          <ToolbarButton icon="cog" variant="canvas" isOpen={isOpen} />
        </Dropdown>
      );
    }

    return <></>;
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    popover: css({
      display: 'flex',
      padding: theme.spacing(2),
      flexDirection: 'column',
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      zIndex: 1,
      marginRight: theme.spacing(2),
    }),
    heading: css({
      fontWeight: theme.typography.fontWeightMedium,
      paddingBottom: theme.spacing(2),
    }),
    options: css({
      display: 'grid',
      gridTemplateColumns: '1fr 50px',
      rowGap: theme.spacing(1),
      columnGap: theme.spacing(2),
      alignItems: 'center',
    }),
  };
}
