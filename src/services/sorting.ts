import { ChangepointDetector } from '@bsull/augurs';
import { DataFrame, FieldType, ReducerID, doStandardCalcs, fieldReducers } from '@grafana/data';
import { getLabelValueFromDataFrame } from './levels';

export const sortSeries = (series: DataFrame[], sortBy: string, direction: string) => {
  if (sortBy === 'alphabetical') {
    return sortSeriesByName(series, direction);
  }

  const reducer = (dataFrame: DataFrame) => {
    if (sortBy === 'changepoint') {
      if (wasmSupported()) {
        return calculateDataFrameChangepoints(dataFrame);
      } else {
        console.warn('Changepoint not supported, using stdDev');
        sortBy = ReducerID.stdDev;
      }
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

const wasmSupported = () => {
  return typeof WebAssembly === 'object';
};
