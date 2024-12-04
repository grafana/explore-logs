import { Button, Icon, Tooltip, useStyles2 } from '@grafana/ui';
import React from 'react';
import { GrafanaTheme2, LoadingState, PanelData } from '@grafana/data';
import { css } from '@emotion/css';
import {
  SceneComponentProps,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { LabelValuesBreakdownScene } from './LabelValuesBreakdownScene';
import { FieldValuesBreakdownScene } from './FieldValuesBreakdownScene';

export const MAX_NUMBER_OF_TIME_SERIES = 20;

export interface TimeSeriesLimitSeriesTitleItemSceneState extends SceneObjectState {
  toggleShowAllSeries: (model: TimeSeriesLimitSeriesTitleItemScene) => void;
  showAllSeries: boolean;
  currentSeriesCount?: number;
  defaultSeriesLimit: number;
}

export class TimeSeriesLimitSeriesTitleItemScene extends SceneObjectBase<TimeSeriesLimitSeriesTitleItemSceneState> {
  constructor(state: TimeSeriesLimitSeriesTitleItemSceneState) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    const valueBreakdown = sceneGraph.findObject(
      this,
      (o) => o instanceof LabelValuesBreakdownScene || o instanceof FieldValuesBreakdownScene
    );
    const $data = sceneGraph.findDescendents(
      valueBreakdown ?? sceneGraph.getAncestor(this, VizPanel),
      SceneQueryRunner
    )[0];

    this._subs.add(
      $data.subscribeToState((newState, prevState) => {
        if ($data.state.data?.state === LoadingState.Done) {
          this.setState({
            currentSeriesCount: $data.state.data?.series.length,
          });
        }
      })
    );
  }
  public static Component = ({ model }: SceneComponentProps<TimeSeriesLimitSeriesTitleItemScene>) => {
    const { toggleShowAllSeries, showAllSeries, currentSeriesCount, defaultSeriesLimit } = model.useState();
    const $data = sceneGraph.getData(model);
    const { data } = $data.useState();
    const styles = useStyles2(getStyles);

    if (
      !($data instanceof SceneDataTransformer) ||
      showAllSeries ||
      data?.state !== LoadingState.Done ||
      !currentSeriesCount ||
      data.series.length < defaultSeriesLimit
    ) {
      return null;
    }

    //@todo is there a better way to get the total number of series before transforming then accessing a private prop?
    const prevData: PanelData | undefined = $data['_prevDataFromSource'];
    const totalLength = prevData?.series.length;

    return (
      <div key="disclaimer" className={styles.timeSeriesDisclaimer}>
        <span className={styles.warningMessage}>
          <>
            <Icon title={`Showing only ${defaultSeriesLimit} series`} name="exclamation-triangle" aria-hidden="true" />
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
export function limitMaxNumberOfSeriesForPanel(
  panel: VizPanel,
  dataTransformer: SceneDataTransformer,
  defaultSeriesLimit = MAX_NUMBER_OF_TIME_SERIES
) {
  panel?.setState({
    titleItems: [
      new TimeSeriesLimitSeriesTitleItemScene({
        defaultSeriesLimit: defaultSeriesLimit,
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
    ],
  });
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
