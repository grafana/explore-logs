import { from, isObservable, Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  FieldCache,
  FieldConfig,
  FieldType,
  LoadingState,
  LogLevel,
  rangeUtil,
  TimeRange,
} from '@grafana/data';
import {
  AxisPlacement,
  BarAlignment,
  FieldColorModeId,
  GraphDrawStyle,
  GraphGradientMode,
  SortOrder,
  StackingMode,
  TooltipDisplayMode,
  VizOrientation,
} from '@grafana/schema';
import { colors } from '@grafana/ui';

import { LokiDatasource, LokiQuery } from './lokiTypes';

export const DEFAULT_LEVEL_LABEL = 'level';

/**
 *
 * Used to query logs volume.
 * Holds a logic to create a correct query - for example to calculate interval based on time range.
 * Updates the data frame to set proper graph config (e.g. color, stacking, draw style) for logs volume.
 * isLevelVolume - if true, the logs volume will be displayed as a vertical bar chart with specified colors for each log level.
 */
export function queryLogsVolume(
  dataSource: LokiDatasource,
  logsVolumeRequest: DataQueryRequest<LokiQuery>,
  timeRange: TimeRange,
  panelHeight: number,
  label: string,
  logsQuery: string
): Observable<DataQueryResponse> {
  const intervalInfo = calculateIntervalForLogsVolume(timeRange, panelHeight);

  logsVolumeRequest.interval = intervalInfo.interval;
  logsVolumeRequest.intervalMs = intervalInfo.intervalMs;
  logsVolumeRequest.hideFromInspector = true;
  logsVolumeRequest.requestId = 'logs-volume-logs-app';

  return new Observable((observer) => {
    let logsVolumeData: DataFrame[] = [];
    observer.next({
      state: LoadingState.Loading,
      error: undefined,
      data: [],
    });

    const queryResponse = dataSource.query(logsVolumeRequest);
    const queryObservable: Observable<DataQueryResponse> = isObservable(queryResponse)
      ? queryResponse
      : from(queryResponse);

    const subscription = queryObservable.subscribe({
      complete: () => {
        observer.complete();
      },
      next: (dataQueryResponse: DataQueryResponse) => {
        const { error } = dataQueryResponse;
        if (error !== undefined) {
          observer.next({
            state: LoadingState.Error,
            error,
            data: [],
          });
          observer.error(error);
        } else {
          logsVolumeData = dataQueryResponse.data.map((dataFrame) => {
            return updateLogsVolumeConfig(dataFrame, timeRange, dataSource.uid, label, logsQuery);
          });

          observer.next({
            state: dataQueryResponse.state,
            error: undefined,
            data: logsVolumeData,
          });
        }
      },
      error: (error) => {
        observer.next({
          state: LoadingState.Error,
          error: error,
          data: [],
        });
        observer.error(error);
      },
    });
    return () => {
      subscription?.unsubscribe();
    };
  });
}

/**
 * Returns default options for time series panel to be displayed as vertical logs volume.
 */
export function getLogVolumeGraphOptions() {
  return {
    legend: {
      showLegend: false,
    },
    tooltip: {
      mode: TooltipDisplayMode.Multi,
      sort: SortOrder.Ascending,
    },
    orientation: VizOrientation.Vertical,
  };
}

/**
 * Returns default options for data frames to be displayed as vertical logs volume.
 */
function getLogVolumeFieldConfig(level?: LogLevel) {
  const config: FieldConfig = {
    color: {
      mode: FieldColorModeId.PaletteClassic,
    },
    custom: {
      axisPlacement: AxisPlacement.Hidden,
      axisLabel: '',
      axisBorderShow: false,
      showValue: 'never',
      gradientMode: GraphGradientMode.None,
      drawStyle: GraphDrawStyle.Bars,
      stacking: {
        mode: StackingMode.Normal,
        group: 'A',
      },
      barAlignment: BarAlignment.Center,
      lineWidth: 0,
      fillOpacity: 100,
    },
  };

  if (level) {
    config.displayNameFromDS = level;
    config.color = {
      mode: FieldColorModeId.Fixed,
      fixedColor: LogLevelColor[level],
    };
  }

  return config;
}

/**
 * Updates the data frame to set proper graph config for logs volume.
 */
export const updateLogsVolumeConfig = (
  dataFrame: DataFrame,
  timeRange: TimeRange,
  dataSourceUid: string,
  label: string,
  logsQuery: string
): DataFrame => {
  dataFrame.fields = dataFrame.fields.map((field) => {
    field.config = {
      ...field.config,
      ...getLogVolumeFieldConfig(label === DEFAULT_LEVEL_LABEL ? extractLevel(dataFrame) : undefined),
    };
    return field;
  });
  // Add time range and data source uid to meta to be able to reuse the data
  dataFrame.meta = {
    ...dataFrame?.meta,
    custom: {
      ...dataFrame.meta?.custom,
      queriedTimeRange: timeRange,
      queriedDataSourceUid: dataSourceUid,
      queriedLabel: label,
      queriedLogsQuery: logsQuery,
    },
  };
  return dataFrame;
};

/**
 * Extracts log level from data frame field that has type of FieldType.number and has labels.
 * Otherwise returns LogLevel.unknown.
 */
function extractLevel(dataFrame: DataFrame): LogLevel {
  let valueField;
  try {
    valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
  } catch {}
  return valueField?.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
}

/**
 * Hold a logic to test different level keywords and return a log level.
 * If none is found, returns LogLevel.unknown.
 */
function getLogLevelFromLabels(labels: Record<string, string>): LogLevel {
  const levelKeywords = ['level', 'lvl', 'loglevel'];
  let level = LogLevel.unknown;
  for (const keyword of levelKeywords) {
    if (labels[keyword]) {
      level = getLogLevelFromKey(labels[keyword]);
      break;
    }
  }
  return level;
}

/**
 * Checks if the level value is a valid LogLevel and returns it.
 * If not, returns LogLevel.unknown.
 */
function getLogLevelFromKey(key: string | number): LogLevel {
  const level = LogLevel[key.toString().toLowerCase() as keyof typeof LogLevel];
  if (level) {
    return level;
  }
  return LogLevel.unknown;
}

/**
 * Calculates the interval for logs volume based on the time range and the interval.
 * TODO: We should improve this function to provide better bucketing for logs volume.
 */
function calculateIntervalForLogsVolume(
  timeRange: TimeRange,
  panelHeight: number
): { interval: string; intervalMs: number } {
  let bucketsCount = 100;
  // If the panel is small, we should reduce the number of buckets
  if (panelHeight < 300) {
    bucketsCount = 50;
  }
  return rangeUtil.calculateInterval(timeRange, bucketsCount, '1ms');
}

/**
 * Colors for log levels.
 */
export const LogLevelColor = {
  [LogLevel.critical]: colors[7],
  [LogLevel.warning]: colors[1],
  [LogLevel.error]: colors[4],
  [LogLevel.info]: colors[0],
  [LogLevel.debug]: colors[5],
  [LogLevel.trace]: colors[2],
  [LogLevel.unknown]: '#bdc4cd',
};

export function shouldReuseSupplementaryQueryData(
  supplementaryQueryData: DataQueryResponse | null,
  selectedTimeRange: TimeRange,
  selectedDataSourceUid: string,
  label: string,
  logsQuery: string
): boolean {
  if (!supplementaryQueryData || !supplementaryQueryData.data.length) {
    return false;
  }

  return supplementaryQueryData.data.every((data: DataFrame) => {
    // We enhance the data frame with the queried time range and data source uid to be able to reuse the data
    const previousDataRange: TimeRange | undefined = data.meta?.custom?.queriedTimeRange;
    const previousDataSourceUid: string | undefined = data.meta?.custom?.queriedDataSourceUid;
    const previousLabel: string | undefined = data.meta?.custom?.queriedLabel;
    const previousLogsQuery: string | undefined = data.meta?.custom?.queriedLogsQuery;

    if (!previousDataRange || !previousDataSourceUid || !data.meta?.custom?.queriedLabel || !logsQuery) {
      return false;
    }

    if (previousDataSourceUid !== selectedDataSourceUid || previousLabel !== label || previousLogsQuery !== logsQuery) {
      return false;
    }

    // check if a new range is within the previous range and the zoom range is at least 50% of the previous range to avoid reusing data for small zooms
    const ZOOM_RANGE_FACTOR = 0.5;
    const hasWiderRange =
      previousDataRange &&
      previousDataRange.from <= selectedTimeRange.from &&
      selectedTimeRange.to <= previousDataRange.to;
    const withinZoomInRange =
      (selectedTimeRange.to.unix() - selectedTimeRange.from.unix()) /
        (previousDataRange.to.unix() - previousDataRange.from.unix()) >=
      ZOOM_RANGE_FACTOR;
    return hasWiderRange && withinZoomInRange;
  });
}
