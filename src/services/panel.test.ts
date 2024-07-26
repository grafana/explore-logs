import { FieldType, createDataFrame } from '@grafana/data';
import { setLeverColorOverrides, sortLevelTransformation } from './panel';
import { lastValueFrom, of } from 'rxjs';

describe('setLeverColorOverrides', () => {
  test('Sets the color overrides for log levels', () => {
    const overrideColorMock = jest.fn();
    const matchFieldsWithNameMock = jest.fn().mockImplementation(() => ({ overrideColor: overrideColorMock }));

    const overrides = {
      matchFieldsWithName: matchFieldsWithNameMock,
    };
    // @ts-expect-error
    setLeverColorOverrides(overrides);

    expect(matchFieldsWithNameMock).toHaveBeenCalledTimes(5);
    expect(overrideColorMock).toHaveBeenCalledTimes(5);
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('info');
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('debug');
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('error');
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('warn');
    expect(matchFieldsWithNameMock).toHaveBeenCalledWith('logs');
  });
});

describe('sortLevelTransformation', () => {
  const dataFrameA = createDataFrame({
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'error',
        },
        values: [23],
      },
    ],
  });
  const dataFrameB = createDataFrame({
    refId: 'B',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'warn',
        },
        values: [23],
      },
    ],
  });
  const dataFrameC = createDataFrame({
    refId: 'C',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1645029699311],
      },
      {
        name: 'Value',
        type: FieldType.number,
        labels: {
          level: 'error',
          location: 'moon',
          protocol: 'http',
        },
        config: {
          displayNameFromDS: 'info',
        },
        values: [23],
      },
    ],
  });
  test('Sorts data frames by level', async () => {
    const result = await lastValueFrom(sortLevelTransformation()(of([dataFrameA, dataFrameB, dataFrameC])));
    expect(result).toEqual([dataFrameC, dataFrameB, dataFrameA]);
  });
});
