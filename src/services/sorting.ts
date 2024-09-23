import { ChangepointDetector, OutlierDetector, OutlierOutput } from '@bsull/augurs';
import { DataFrame, doStandardCalcs, fieldReducers, FieldType, outerJoinDataFrames, ReducerID } from '@grafana/data';
import { getLabelValueFromDataFrame } from './levels';
import { memoize } from 'lodash';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from './analytics';
import { logger } from './logger';

export const DEFAULT_SORT_BY = 'changepoint';

export const sortSeries = memoize(
  (series: DataFrame[], sortBy: string, direction: string) => {
    if (sortBy === 'alphabetical') {
      return sortSeriesByName(series, direction);
    }

    if (sortBy === 'outliers') {
      initOutlierDetector(series);
    }

    const reducer = (dataFrame: DataFrame) => {
      // ML & Wasm sorting options
      try {
        if (sortBy === 'changepoint') {
          return calculateDataFrameChangepoints(dataFrame);
        } else if (sortBy === 'outliers') {
          return calculateOutlierValue(series, dataFrame);
        }
      } catch (e) {
        logger.error(e, { msg: 'failed to sort' });

        // ML sorting panicked, fallback to stdDev
        sortBy = ReducerID.stdDev;
      }
      const fieldReducer = fieldReducers.get(sortBy);
      const value =
        fieldReducer.reduce?.(dataFrame.fields[1], true, true) ?? doStandardCalcs(dataFrame.fields[1], true, true);
      return value[sortBy] ?? 0;
    };

    const seriesCalcs = series.map((dataFrame) => ({
      value: reducer(dataFrame),
      dataFrame: dataFrame,
    }));

    seriesCalcs.sort((a, b) => {
      if (a.value !== undefined && b.value !== undefined) {
        return b.value - a.value;
      }
      return 0;
    });

    if (direction === 'asc') {
      seriesCalcs.reverse();
    }

    return seriesCalcs.map(({ dataFrame }) => dataFrame);
  },
  (series: DataFrame[], sortBy: string, direction: string) => {
    const firstTimestamp = series.length > 0 ? series[0].fields[0].values[0] : 0;
    const lastTimestamp =
      series.length > 0
        ? series[series.length - 1].fields[0].values[series[series.length - 1].fields[0].values.length - 1]
        : 0;
    const firstValue = series.length > 0 ? getLabelValueFromDataFrame(series[0]) : '';
    const lastValue = series.length > 0 ? getLabelValueFromDataFrame(series[series.length - 1]) : '';
    // This still isn't good enough, if the dataframe returns the same number of fields, with the same start and end values, we'll fail to update the UI
    const allSeriesKey = series.map(
      (frame) =>
        frame.length +
        '_' +
        frame.fields.map((field) => field.name + '_' + field.values[0] + '_' + field.values[field.values.length - 1])
    );
    return `${firstValue}_${lastValue}_${firstTimestamp}_${lastTimestamp}_${series.length}_${allSeriesKey}_${sortBy}_${direction}`;
  }
);

export const calculateDataFrameChangepoints = (data: DataFrame) => {
  if (!wasmSupported()) {
    throw new Error('WASM not supported, fall back to stdDev');
  }

  const fields = data.fields.filter((f) => f.type === FieldType.number);

  const dataPoints = fields[0].values.length;

  let samplingStep = Math.floor(dataPoints / 100) || 1;
  if (samplingStep > 1) {
    // Avoiding "big" steps for more accuracy
    samplingStep = Math.ceil(samplingStep / 2);
  }

  const sample = fields[0].values.filter((_, i) => i % samplingStep === 0);

  const values = new Float64Array(sample);
  const points = ChangepointDetector.defaultArgpcp().detectChangepoints(values);

  return points.indices.length;
};

export const sortSeriesByName = (series: DataFrame[], direction: string) => {
  const sortedSeries = [...series];
  sortedSeries.sort((a, b) => {
    const valueA = getLabelValueFromDataFrame(a);
    const valueB = getLabelValueFromDataFrame(b);
    if (!valueA || !valueB) {
      return 0;
    }
    return valueA?.localeCompare(valueB) ?? 0;
  });
  if (direction === 'desc') {
    sortedSeries.reverse();
  }
  return sortedSeries;
};

const initOutlierDetector = (series: DataFrame[]) => {
  if (!wasmSupported()) {
    return;
  }

  // Combine all frames into one by joining on time.
  const joined = outerJoinDataFrames({ frames: series });
  if (!joined) {
    return;
  }

  // Get number fields: these are our series.
  const joinedSeries = joined.fields.filter((f) => f.type === FieldType.number);
  const nTimestamps = joinedSeries[0].values.length;
  const points = new Float64Array(joinedSeries.flatMap((series) => series.values as number[]));

  try {
    const detector = OutlierDetector.dbscan({ sensitivity: 0.4 }).preprocess(points, nTimestamps);
    outliers = detector.detect();
  } catch (e) {
    logger.error(e, { msg: 'initOutlierDetector: OutlierDetector error' });
  }
};

let outliers: OutlierOutput | undefined = undefined;

export const calculateOutlierValue = (series: DataFrame[], data: DataFrame): number => {
  if (!wasmSupported()) {
    throw new Error('WASM not supported, fall back to stdDev');
  }
  if (!outliers) {
    throw new Error('Initialize outlier detector first');
  }

  const index = series.indexOf(data);
  if (outliers.seriesResults[index].isOutlier) {
    return outliers.seriesResults[index].outlierIntervals.length;
  }

  return 0;
};

export const wasmSupported = () => {
  const support = typeof WebAssembly === 'object';

  if (!support) {
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.wasm_not_supported);
  }

  return support;
};
