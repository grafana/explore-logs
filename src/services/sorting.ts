import { ChangepointDetector } from '@bsull/augurs';
import { DataFrame, FieldType, doStandardCalcs, fieldReducers } from '@grafana/data';
import { getLabelValueFromDataFrame } from './levels';
import { memoize } from 'lodash';

export const sortSeries = memoize(
  (series: DataFrame[], sortBy: string, direction: string) => {
    const reducer = (dataFrame: DataFrame) => {
      if (sortBy === 'changepoint') {
        return calculateDataFrameChangepoints(dataFrame);
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
    const key = `${firstValue}_${lastValue}_${firstTimestamp}_${lastTimestamp}_${series.length}_${sortBy}_${direction}`;
    return key;
  }
);

export const calculateDataFrameChangepoints = (data: DataFrame) => {
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
