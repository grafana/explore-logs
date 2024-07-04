import { ChangepointDetector } from '@bsull/augurs';
import { DataFrame, FieldType, doStandardCalcs, fieldReducers } from '@grafana/data';

export const sortSeries = (series: DataFrame[], sortBy: string, direction: string) => {
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
    if (a.value && b.value) {
      return b.value - a.value;
    }
    return 0;
  });

  if (direction === 'asc') {
    seriesCalcs.reverse();
  }

  return seriesCalcs.map(({ dataFrame }) => dataFrame);
};

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
