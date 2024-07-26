import React from 'react';
import { LoadedOutlierDetector, OutlierDetector } from '@bsull/augurs';
import { DataFrame, DataQueryRequest, FieldType, GrafanaTheme2, PanelData, outerJoinDataFrames } from '@grafana/data';
import { DataTopic } from '@grafana/schema';
import { ButtonGroup, Slider, useStyles2 } from '@grafana/ui';

import {
  SceneComponentProps,
  SceneObjectState,
  SceneObjectBase,
  ExtraQueryProvider,
  ExtraQueryDescriptor,
} from '@grafana/scenes';
import { css, cx } from '@emotion/css';
import { of } from 'rxjs';

// A subset of an outlying series, with a start and end time.
interface Outlier {
  // The index of the series in the data frame.
  series: number;
  // The start time of the outlier.
  start: number;
  // The end time of the outlier, if it's a region.
  end: number;
}

interface SceneOutlierDetectorState extends SceneObjectState {
  sensitivity?: number;
  addAnnotations?: boolean;
  onOutlierDetected?: (outlier: Outlier) => void;
}

const DEFAULT_SENSITIVITY = 0.4;

export class SceneOutlierDetector
  extends SceneObjectBase<SceneOutlierDetectorState>
  implements ExtraQueryProvider<SceneOutlierDetectorState>
{
  public static Component = SceneOutlierDetectorRenderer;

  public constructor(state: Partial<SceneOutlierDetectorState>) {
    super(state);
  }

  public onSensitivityChanged(sensitivity: number | undefined) {
    this.setState({ sensitivity });
  }

  public onAddAnnotationsChanged(addAnnotations: boolean) {
    this.setState({ addAnnotations });
  }

  public getExtraQueries(primary: DataQueryRequest): ExtraQueryDescriptor[] {
    const { sensitivity } = this.state;
    return sensitivity === undefined
      ? []
      : [
          {
            req: {
              ...primary,
              targets: [],
            },
            processor: (data, _) => {
              const frames = data.series;
              // Combine all frames into one by joining on time.
              const joined = outerJoinDataFrames({ frames });
              if (joined === undefined) {
                return of(data);
              }

              try {
                const detector = createDetector(joined, sensitivity);
                const dataWithOutliers = addOutliers(
                  detector,
                  data,
                  joined,
                  this.state.addAnnotations ?? true,
                  this.state.onOutlierDetected
                );
                return of(dataWithOutliers);
              } catch (error) {
                console.error(error);
                return of(data);
              }
            },
          },
        ];
  }

  public shouldRerun(prev: SceneOutlierDetectorState, next: SceneOutlierDetectorState): boolean {
    return prev.sensitivity !== next.sensitivity;
  }
}

function createDetector(data: DataFrame, sensitivity: number): LoadedOutlierDetector {
  // Get number fields: these are our series.
  const serieses = data.fields.filter((f) => f.type === FieldType.number);
  const nTimestamps = serieses[0].values.length;
  const points = new Float64Array(serieses.flatMap((series) => series.values as number[]));
  return OutlierDetector.dbscan({ sensitivity }).preprocess(points, nTimestamps);
}

function addOutliers(
  detector: LoadedOutlierDetector,
  data: PanelData,
  joined: DataFrame,
  addAnnotations: boolean,
  onOutlierDetected?: (outlier: Outlier) => void
): PanelData {
  // TODO: avoid duplicating the serieses extraction.
  const serieses = joined.fields.filter((f) => f.type === FieldType.number);
  const nTimestamps = joined.fields[0].values.length;
  const outliers = detector.detect();

  if (onOutlierDetected !== undefined) {
    const idx = 0;
    for (const s of outliers.seriesResults) {
      for (const i of s.outlierIntervals) {
        onOutlierDetected({
          series: idx,
          start: joined.fields[0].values[i.start],
          end: joined.fields[0].values[i.end ?? nTimestamps - 1],
        });
      }
    }
  }

  const annotations = [];
  if (addAnnotations) {
    const outlierStartTimes = outliers.seriesResults.flatMap((s) =>
      s.outlierIntervals.map((interval) => joined.fields[0].values[interval.start])
    );
    const outlierEndTimes = outliers.seriesResults.flatMap((s) =>
      s.outlierIntervals.map((interval) => joined.fields[0].values[interval.end ?? nTimestamps - 1])
    );
    const outlierAnnotationTexts = outliers.seriesResults.flatMap((s, i) =>
      s.outlierIntervals.map((_) => `Outlier detected in series ${serieses[i].name}`)
    );
    annotations.push({
      fields: [
        {
          name: 'time',
          type: FieldType.time,
          values: outlierStartTimes,
          config: {},
        },
        {
          name: 'timeEnd',
          type: FieldType.time,
          values: outlierEndTimes,
          config: {},
        },
        {
          name: 'text',
          type: FieldType.string,
          values: outlierAnnotationTexts,
          config: {},
        },
        {
          name: 'isRegion',
          type: FieldType.boolean,
          values: Array(outlierStartTimes.length).fill(true),
          config: {},
        },
      ],
      length: outlierStartTimes.length,
      meta: {
        dataTopic: DataTopic.Annotations,
      },
    });
  }

  return {
    ...data,
    annotations,
  };
}

function SceneOutlierDetectorRenderer({ model }: SceneComponentProps<SceneOutlierDetector>) {
  const styles = useStyles2(getStyles);
  const { sensitivity } = model.useState();

  const onChangeSensitivity = (e: number | undefined) => {
    model.onSensitivityChanged(e);
  };

  const sliderStyles = sensitivity === undefined ? cx(styles.slider, styles.disabled) : styles.slider;

  return (
    <ButtonGroup>
      <div className={sliderStyles}>
        <Slider
          onAfterChange={onChangeSensitivity}
          min={0.01}
          max={0.99}
          step={0.01}
          value={sensitivity ?? DEFAULT_SENSITIVITY}
        />
      </div>
    </ButtonGroup>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    disabled: css`
      & > div {
        opacity: 0.2;
      }
    `,
    slider: css`
      display: flex;
      width: 120px;
      align-items: center;
      border: 1px solid ${theme.colors.secondary.border};
      & > div {
        .rc-slider {
          margin: auto 16px;
        }
        .rc-slider + div {
          display: none;
        }
      }
    `,
  };
}
