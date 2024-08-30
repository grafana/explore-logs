import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { css } from '@emotion/css';
import {
  SceneComponentProps,
  SceneCSSGridItem,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';

export const MAX_NUMBER_OF_TIME_SERIES = 20;

export interface TimeSeriesLimitSeriesTitleItemSceneState extends SceneObjectState {
  toggleShowAllSeries: (model: TimeSeriesLimitSeriesTitleItemScene) => void;
  showAllSeries: boolean;
  currentSeriesCount?: number;
}

export class TimeSeriesLimitSeriesTitleItemScene extends SceneObjectBase<TimeSeriesLimitSeriesTitleItemSceneState> {
  constructor(state: TimeSeriesLimitSeriesTitleItemSceneState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const panel = sceneGraph.getAncestor(this, VizPanel);
    this._subs.add(
      panel.subscribeToState((newState, prevState) => {
        const $data = sceneGraph.getData(this);
        if ($data.state.data?.state === LoadingState.Done) {
          this.setState({
            currentSeriesCount: $data.state.data?.series.length,
          });
        }
      })
    );
  }
  public static Component = ({ model }: SceneComponentProps<TimeSeriesLimitSeriesTitleItemScene>) => {
    const { toggleShowAllSeries, showAllSeries, currentSeriesCount } = model.useState();
    const $data = sceneGraph.getData(model);
    const { data } = $data.useState();
    const styles = useStyles2(getStyles);

    if (
      !($data instanceof SceneDataTransformer) ||
      showAllSeries ||
      data?.state !== LoadingState.Done ||
      !currentSeriesCount ||
      data.series.length < MAX_NUMBER_OF_TIME_SERIES
    ) {
      return null;
    }

    //@todo is there a better way to get the total number of series before transforming then accessing a private prop?
    const prevData: PanelData = $data['_prevDataFromSource'];
    const totalLength = prevData.series.length;

    return (
      <div key="disclaimer" className={styles.timeSeriesDisclaimer}>
        <span className={styles.warningMessage}>
          <>
            <Icon
              title={`Showing only ${MAX_NUMBER_OF_TIME_SERIES} series`}
              name="exclamation-triangle"
              aria-hidden="true"
            />
          </>
        </span>
        <Tooltip
          content={
            'Rendering too many series in a single panel may impact performance and make data harder to read. Consider adding more filters.'
          }
        >
          <Button variant="secondary" size="sm" onClick={() => toggleShowAllSeries(model)}>
            <>Show all {totalLength}</>
          </Button>
        </Tooltip>
      </div>
    );
  };
}

export function limitMaxNumberOfSeriesForPanel(child: SceneCSSGridItem) {
  const panel = child.state.body as VizPanel | undefined;
  const dataTransformer = child.state.body?.state.$data;
  if (dataTransformer instanceof SceneDataTransformer) {
    panel?.setState({
      titleItems: new TimeSeriesLimitSeriesTitleItemScene({
        showAllSeries: false,
        toggleShowAllSeries: (timeSeriesLimiter) => {
          dataTransformer.setState({
            transformations: [],
          });
          timeSeriesLimiter.setState({
            showAllSeries: true,
          });
          dataTransformer.reprocessTransformations();
        },
      }),
    });
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  timeSeriesDisclaimer: css({
    label: 'time-series-disclaimer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  warningMessage: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.warning.main,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
});
