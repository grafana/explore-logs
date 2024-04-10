import { Observable } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  dateTime,
  FieldType,
  LoadingState,
  TimeRange,
} from '@grafana/data';
import { FieldColorModeId } from '@grafana/schema';
import { AxisPlacement } from '@grafana/ui';

import { LokiDatasourceMock } from '@/components/Context/__mocks__/LokiDataSource';
import { timeRangeMock } from '@/components/Context/__mocks__/timeRange';

import {
  DEFAULT_LEVEL_LABEL,
  LogLevelColor,
  queryLogsVolume,
  shouldReuseSupplementaryQueryData,
  updateLogsVolumeConfig,
} from './logsVolume';
import { LokiDatasource, LokiQuery } from './lokiTypes';

describe('queryLogsVolume', () => {
  const mockDataResponse: DataQueryResponse = {
    data: [
      {
        refId: 'A',
        fields: [
          { name: 'Time', values: [0, 1, 2], type: FieldType.time },
          { name: 'Value', values: [10, 5, 3, 12], type: FieldType.number, labels: { level: 'info' } },
        ],
      },
    ],
    error: undefined,
    state: LoadingState.Done,
  };

  const lokiDataSourceMock = new LokiDatasourceMock() as unknown as LokiDatasource;
  lokiDataSourceMock.query = jest.fn().mockResolvedValue(mockDataResponse);
  const mockLogsQuery = '{app="test"}';
  const mockLogVolumeRequest = {
    range: timeRangeMock,
    intervalMs: 2000,
    interval: '2s',
    requestId: 'logs-volume-logs-app',
    targets: [
      {
        refId: 'A',
        expr: `sum by (level) count_over_time(${mockLogsQuery} | logfmt[5m])`,
      },
    ],
  } as unknown as DataQueryRequest<LokiQuery>;
  const height = 400;

  test('should return an observable', () => {
    const result = queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      height,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    );
    expect(result).toBeInstanceOf(Observable);
  });

  test('should update interval and intervalMs based on time range', () => {
    queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      height,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    ).subscribe();
    expect(lokiDataSourceMock.query).toHaveBeenCalledWith({
      ...mockLogVolumeRequest,
      interval: '2m',
      intervalMs: 120000,
    });
  });

  test('should update interval and intervalMs based small panel height', () => {
    const smallHeight = 100;
    queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      smallHeight,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    ).subscribe();
    expect(lokiDataSourceMock.query).toHaveBeenCalledWith({
      ...mockLogVolumeRequest,
      interval: '5m',
      intervalMs: 300000,
    });
  });

  test('should hide query from inspector', () => {
    queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      height,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    ).subscribe();
    expect(lokiDataSourceMock.query).toHaveBeenCalledWith({
      ...mockLogVolumeRequest,
      hideFromInspector: true,
    });
  });

  test('should correctly emit values', (done) => {
    let index = 0;
    const expected = [{ data: [], error: undefined, state: LoadingState.Loading }, mockDataResponse];
    queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      height,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    ).subscribe({
      next: (value) => {
        try {
          expect(value).toEqual(expected[index]);
          index++;
        } catch (error) {
          done(error);
        }
      },
      complete: () => done(),
    });
  });

  test('should add visualisation config to data', (done) => {
    let index = 0;
    queryLogsVolume(
      lokiDataSourceMock,
      mockLogVolumeRequest,
      mockLogVolumeRequest.range,
      height,
      DEFAULT_LEVEL_LABEL,
      mockLogsQuery
    ).subscribe({
      next: (value) => {
        try {
          if (index === 1) {
            expect(value.data[0].fields[0]).toEqual(
              expect.objectContaining({
                // sample of custom styling
                config: expect.objectContaining({
                  custom: expect.objectContaining({
                    axisPlacement: AxisPlacement.Hidden,
                  }),
                }),
              })
            );
          }
          index++;
        } catch (error) {
          console.log('error', error);
          done(error);
        }
      },
      complete: () => done(),
    });
  });
});

describe('updateLogsVolumeGraphConfig', () => {
  const mockLogsQuery = '{app="test"}';
  const lokiDataSourceMock = new LokiDatasourceMock();
  const dataFrame: DataFrame = {
    refId: 'A',
    length: 3,
    fields: [
      { name: 'Time', values: [0, 1, 2], type: FieldType.time, config: {} },
      { name: 'Value', values: [10, 5, 3, 12], type: FieldType.number, labels: { level: 'info' }, config: {} },
    ],
  };

  test('should update color of series based on level if levelVolume', () => {
    expect(
      updateLogsVolumeConfig(dataFrame, timeRangeMock, lokiDataSourceMock.uid, DEFAULT_LEVEL_LABEL, mockLogsQuery)
        .fields[1].config
    ).toEqual(
      expect.objectContaining({
        color: {
          fixedColor: LogLevelColor.info,
          mode: FieldColorModeId.Fixed,
        },
      })
    );
  });

  test('should not update color of series based on level if not levelVolume', () => {
    expect(
      updateLogsVolumeConfig(dataFrame, timeRangeMock, lokiDataSourceMock.uid, 'otherLabel', mockLogsQuery).fields[1]
        .config
    ).toEqual(
      expect.objectContaining({
        color: {
          mode: FieldColorModeId.PaletteClassic,
          color: undefined,
        },
      })
    );
  });

  test('should update meta with used props', () => {
    expect(
      updateLogsVolumeConfig(dataFrame, timeRangeMock, lokiDataSourceMock.uid, DEFAULT_LEVEL_LABEL, mockLogsQuery).meta
    ).toEqual(
      expect.objectContaining({
        custom: {
          queriedTimeRange: timeRangeMock,
          queriedDataSourceUid: lokiDataSourceMock.uid,
          queriedLabel: DEFAULT_LEVEL_LABEL,
          queriedLogsQuery: mockLogsQuery,
        },
      })
    );
  });
});

describe('shouldReuseSupplementaryQueryData', () => {
  const mockLogsQuery = '{app="test"}';
  const dataSourceUid = 'same';
  const dataFrame: DataFrame = {
    refId: 'A',
    length: 3,
    fields: [
      { name: 'Time', values: [0, 1, 2], type: FieldType.time, config: {} },
      { name: 'Value', values: [10, 5, 3, 12], type: FieldType.number, labels: { level: 'info' }, config: {} },
    ],
    meta: {
      custom: {
        queriedTimeRange: timeRangeMock,
        queriedDataSourceUid: dataSourceUid,
        queriedLabel: DEFAULT_LEVEL_LABEL,
        queriedLogsQuery: mockLogsQuery,
      },
    },
  };
  test('should return true if time range and data source uid are the same', () => {
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        timeRangeMock,
        dataSourceUid,
        DEFAULT_LEVEL_LABEL,
        mockLogsQuery
      )
    ).toEqual(true);
  });
  test('should return false if data source uid is not the same', () => {
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        timeRangeMock,
        'different',
        DEFAULT_LEVEL_LABEL,
        mockLogsQuery
      )
    ).toEqual(false);
  });

  test('should return false if time range is outside of selected range', () => {
    const from = dateTime(timeRangeMock.from).subtract(1, 'hour');
    const selectedTimeRange: TimeRange = {
      from,
      to: timeRangeMock.to,
      raw: {
        from,
        to: timeRangeMock.to,
      },
    };
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        selectedTimeRange,
        dataSourceUid,
        DEFAULT_LEVEL_LABEL,
        mockLogsQuery
      )
    ).toEqual(false);
  });

  test('should return true if time range is within the selected range', () => {
    const from = dateTime(timeRangeMock.from).add(1, 'minute');
    const selectedTimeRange: TimeRange = {
      from,
      to: timeRangeMock.to,
      raw: {
        from,
        to: timeRangeMock.to,
      },
    };
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        selectedTimeRange,
        dataSourceUid,
        DEFAULT_LEVEL_LABEL,
        mockLogsQuery
      )
    ).toEqual(true);
  });

  test('should return false if selected time range is less than zoom factor ', () => {
    const from = dateTime(timeRangeMock.from).add(2, 'hours');
    const selectedTimeRange: TimeRange = {
      from,
      to: timeRangeMock.to,
      raw: {
        from,
        to: timeRangeMock.to,
      },
    };
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        selectedTimeRange,
        dataSourceUid,
        DEFAULT_LEVEL_LABEL,
        mockLogsQuery
      )
    ).toEqual(false);
  });

  test('should return false if isSameVolumeLabel is false', () => {
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        timeRangeMock,
        dataSourceUid,
        'othherLabel',
        mockLogsQuery
      )
    ).toEqual(false);
  });

  test('should return true if the same original log query', () => {
    expect(
      shouldReuseSupplementaryQueryData(
        { data: [dataFrame] },
        timeRangeMock,
        dataSourceUid,
        'othherLabel',
        mockLogsQuery
      )
    ).toEqual(false);
  });
});
