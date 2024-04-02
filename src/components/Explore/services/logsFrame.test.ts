import { DataFrameType, Field, FieldType, Labels } from '@grafana/data';

import { logFrameLabelsToLabels, parseLogsFrame } from './logsFrame';

function makeString(name: string, values: string[], labels?: Labels): Field {
  return {
    name,
    type: FieldType.string,
    config: {},
    values,
    labels,
  };
}

function makeTime(name: string, values: number[], nanos?: number[]): Field {
  return {
    name,
    type: FieldType.time,
    config: {},
    values,
  };
}

function makeObject(name: string, values: Object[]): Field {
  return {
    name,
    type: FieldType.other,
    config: {},
    values,
  };
}

describe('parseLogsFrame should parse different logs-dataframe formats', () => {
  it('should parse a dataplane-complaint logs frame', () => {
    const time = makeTime('timestamp', [1687185711795, 1687185711995]);
    const body = makeString('body', ['line1', 'line2']);
    const severity = makeString('severity', ['info', 'debug']);
    const id = makeString('id', ['id1', 'id2']);
    const labels = makeObject('labels', [
      { counter: '38141', label: 'val2', level: 'warning', nested: { a: '1', b: ['2', '3'] } },
      { counter: '38143', label: 'val2', level: 'info', nested: { a: '11', b: ['12', '13'] } },
    ]);

    const result = parseLogsFrame({
      meta: {
        type: DataFrameType.LogLines,
      },
      fields: [id, body, labels, severity, time],
      length: 2,
    });

    expect(result).not.toBeNull();

    expect(result!.timeField.values[0]).toBe(time.values[0]);
    expect(result!.bodyField.values[0]).toBe(body.values[0]);
    expect(result!.idField?.values[0]).toBe(id.values[0]);
    expect(result!.timeNanosecondField).toBeNull();
    expect(result!.severityField?.values[0]).toBe(severity.values[0]);
    expect(result!.getLogFrameLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning', nested: { a: '1', b: ['2', '3'] } },
      { counter: '38143', label: 'val2', level: 'info', nested: { a: '11', b: ['12', '13'] } },
    ]);
    expect(result!.getLogFrameLabelsAsLabels()).toStrictEqual([
      { counter: '38141', label: 'val2', level: 'warning', nested: `{"a":"1","b":["2","3"]}` },
      { counter: '38143', label: 'val2', level: 'info', nested: `{"a":"11","b":["12","13"]}` },
    ]);
    expect(result?.extraFields).toStrictEqual([]);
  });
});

describe('logFrameLabelsToLabels', () => {
  it('should convert nested structures correctly', () => {
    expect(
      logFrameLabelsToLabels({
        key1: 'val1',
        key2: ['k2v1', 'k2v2', 'k2v3'],
        key3: {
          k3k1: 'v1',
          k3k2: 'v2',
          k3k3: [
            'k3k3v1',
            {
              k3k3k1: 'one',
              k3k3k2: 'two',
            },
          ],
        },
      })
    ).toStrictEqual({
      key1: 'val1',
      key2: '["k2v1","k2v2","k2v3"]',
      key3: '{"k3k1":"v1","k3k2":"v2","k3k3":["k3k3v1",{"k3k3k1":"one","k3k3k2":"two"}]}',
    });
  });

  it('should convert not-nested structures correctly', () => {
    expect(
      logFrameLabelsToLabels({
        key1: 'val1',
        key2: 'val2',
      })
    ).toStrictEqual({
      key1: 'val1',
      key2: 'val2',
    });
    // FIXME
  });
});
