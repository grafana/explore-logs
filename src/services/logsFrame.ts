import { DataFrame, DataFrameType, Field, FieldCache, FieldType, FieldWithIndex, Labels } from '@grafana/data';

// these are like Labels, but their values can be
// arbitrary structures, not just strings
export type LogFrameLabels = Record<string, unknown>;

// the attributes-access is a little awkward, but it's necessary
// because there are multiple,very different dataFrame-representations.
export type LogsFrame = {
  timeField: FieldWithIndex;
  bodyField: FieldWithIndex;
  timeNanosecondField: FieldWithIndex | null;
  severityField: FieldWithIndex | null;
  idField: FieldWithIndex | null;
  getLogFrameLabels: () => LogFrameLabels[] | null; // may be slow, so we only do it when asked for it explicitly
  getLogFrameLabelsAsLabels: () => Labels[] | null; // temporarily exists to make the labels=>attributes migration simpler
  getLabelFieldName: () => string | null;
  extraFields: FieldWithIndex[];
  raw: DataFrame;
};

function getField(cache: FieldCache, name: string, fieldType: FieldType): FieldWithIndex | undefined {
  const field = cache.getFieldByName(name);
  if (field === undefined) {
    return undefined;
  }

  return field.type === fieldType ? field : undefined;
}

export const DATAPLANE_TIMESTAMP_NAME = 'timestamp';
export const DATAPLANE_BODY_NAME = 'body';
export const DATAPLANE_SEVERITY_NAME = 'severity';
export const DATAPLANE_ID_NAME = 'id';
export const DATAPLANE_LABELS_NAME = 'labels';

export function logFrameLabelsToLabels(logFrameLabels: LogFrameLabels): Labels {
  const result: Labels = {};

  Object.entries(logFrameLabels).forEach(([k, v]) => {
    result[k] = typeof v === 'string' ? v : JSON.stringify(v);
  });

  return result;
}

export function parseLogsFrame(frame: DataFrame): LogsFrame | null {
  if (frame.meta?.type === DataFrameType.LogLines) {
    return parseDataplaneLogsFrame(frame);
  } else {
    return parseLegacyLogsFrame(frame);
  }
}

export function parseDataplaneLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);

  const timestampField = getField(cache, DATAPLANE_TIMESTAMP_NAME, FieldType.time);
  const bodyField = getField(cache, DATAPLANE_BODY_NAME, FieldType.string);

  // these two are mandatory
  if (timestampField === undefined || bodyField === undefined) {
    return null;
  }

  const severityField = getField(cache, DATAPLANE_SEVERITY_NAME, FieldType.string) ?? null;
  const idField = getField(cache, DATAPLANE_ID_NAME, FieldType.string) ?? null;
  const labelsField = getField(cache, DATAPLANE_LABELS_NAME, FieldType.other) ?? null;

  const labels = labelsField === null ? null : labelsField.values;

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timestampField.index &&
      i !== bodyField.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    raw: frame,
    timeField: timestampField,
    bodyField,
    severityField,
    idField,
    getLogFrameLabels: () => labels,
    timeNanosecondField: null,
    getLogFrameLabelsAsLabels: () => (labels !== null ? labels.map(logFrameLabelsToLabels) : null),
    getLabelFieldName: () => (labelsField !== null ? labelsField.name : null),
    extraFields,
  };
}

// Copied from https://github.com/grafana/grafana/blob/main/public/app/features/logs/legacyLogsFrame.ts
export function parseLegacyLogsFrame(frame: DataFrame): LogsFrame | null {
  const cache = new FieldCache(frame);
  const timeField = cache.getFirstFieldOfType(FieldType.time);
  const bodyField = cache.getFirstFieldOfType(FieldType.string);

  // these two are mandatory
  if (timeField === undefined || bodyField === undefined) {
    return null;
  }

  const timeNanosecondField = cache.getFieldByName('tsNs') ?? null;
  const severityField = cache.getFieldByName('level') ?? null;
  const idField = cache.getFieldByName('id') ?? null;

  // extracting the labels is done very differently for old-loki-style and simple-style
  // dataframes, so it's a little awkward to handle it,
  // we both need to on-demand extract the labels, and also get teh labelsField,
  // but only if the labelsField is used.
  const [labelsField, getL] = makeLabelsGetter(cache, bodyField, frame);

  const extraFields = cache.fields.filter(
    (_, i) =>
      i !== timeField.index &&
      i !== bodyField.index &&
      i !== timeNanosecondField?.index &&
      i !== severityField?.index &&
      i !== idField?.index &&
      i !== labelsField?.index
  );

  return {
    timeField,
    bodyField,
    timeNanosecondField,
    severityField,
    idField,
    getLogFrameLabels: getL,
    getLogFrameLabelsAsLabels: getL,
    getLabelFieldName: () => labelsField?.name ?? null,
    extraFields,
    raw: frame,
  };
}

// if the frame has "labels" field with type "other", adjust the behavior.
// we also have to return the labels-field (if we used it),
// to be able to remove it from the unused-fields, later.
function makeLabelsGetter(
  cache: FieldCache,
  lineField: Field,
  frame: DataFrame
): [FieldWithIndex | null, () => Labels[] | null] {
  // If we have labels field with type "other", use that
  const labelsField = cache.getFieldByName('labels');
  if (labelsField !== undefined && labelsField.type === FieldType.other) {
    const values = labelsField.values.map(logFrameLabelsToLabels);
    return [labelsField, () => values];
  } else {
    // Otherwise we use the labels on the line-field, and make an array with it
    return [null, () => makeLabelsArray(lineField, frame.length)];
  }
}

// take the labels from the line-field, and "stretch" it into an array
// with the length of the frame (so there are the same labels for every row)
function makeLabelsArray(lineField: Field, length: number): Labels[] | null {
  const lineLabels = lineField.labels;
  if (lineLabels !== undefined) {
    const result = new Array(length);
    result.fill(lineLabels);
    return result;
  } else {
    return null;
  }
}

export function getTimeName(logsFrame?: LogsFrame) {
  return logsFrame?.timeField.name ?? DATAPLANE_TIMESTAMP_NAME;
}

export function getBodyName(logsFrame?: LogsFrame | null): string {
  return logsFrame?.bodyField.name ?? DATAPLANE_BODY_NAME;
}

export function getIdName(logsFrame?: LogsFrame): string {
  return logsFrame?.idField?.name ?? DATAPLANE_ID_NAME;
}
