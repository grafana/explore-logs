import { DataFrame, PanelData } from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { PanelBuilders, SceneCSSGridItem, SceneDataNode, SceneObject } from '@grafana/scenes';
import { getColorByIndex } from './scenes';
import { AddToFiltersButton } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getLogsFormatVariable, VAR_FIELDS, VAR_LABELS } from './variables';
import { setLevelColorOverrides } from './panel';

export type DetectedLabel = {
  label: string;
  cardinality: number;
};

export type DetectedLabelsResponse = {
  detectedLabels: DetectedLabel[];
};

interface ExtractedFields {
  type: 'logfmt' | 'json';
  fields: string[];
}

export function updateParserFromDataFrame(frame: DataFrame, sceneRef: SceneObject): ExtractedFields {
  const variable = getLogsFormatVariable(sceneRef);
  const res = extractParserAndFieldsFromDataFrame(frame);
  const newType = res.type ? ` | ${res.type}` : '';
  if (variable.getValue() !== newType) {
    variable.changeValueTo(newType);
  }

  return res;
}

export function extractParserAndFieldsFromDataFrame(data: DataFrame) {
  const result: ExtractedFields = { type: 'logfmt', fields: [] };
  const labelTypesField = data.fields.find((f) => f.name === 'labelTypes');
  result.fields = Object.keys(
    labelTypesField?.values.reduce((acc: Record<string, boolean>, value: Record<string, string>) => {
      Object.entries(value)
        .filter(([_, v]) => v === 'P')
        .forEach(([k]) => (acc[k] = true));
      return acc;
    }, {}) ?? {}
  );

  const linesField = data.fields.find((f) => f.name === 'Line' || f.name === 'body');
  result.type = linesField?.values[0]?.[0] === '{' ? 'json' : 'logfmt';

  return result;
}

export function getFilterBreakdownValueScene(
  getTitle: (df: DataFrame) => string,
  style: DrawStyle,
  variableName: typeof VAR_FIELDS | typeof VAR_LABELS
) {
  return (data: PanelData, frame: DataFrame, frameIndex: number) => {
    const panel = PanelBuilders.timeseries() //
      .setOption('legend', { showLegend: false })
      .setCustomFieldConfig('fillOpacity', 9)
      .setTitle(getTitle(frame))
      .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setOverrides(setLevelColorOverrides)
      .setHeaderActions(new AddToFiltersButton({ frame, variableName }));

    if (style === DrawStyle.Bars) {
      panel
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setOverrides(setLevelColorOverrides)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars);
    }
    return new SceneCSSGridItem({
      body: panel.build(),
    });
  };
}

// copied from public/app/plugins/datasource/loki/types.ts
export enum LabelType {
  Indexed = 'I',
  StructuredMetadata = 'S',
  Parsed = 'P',
}

export function getLabelTypeFromFrame(labelKey: string, frame: DataFrame, index = 0): null | LabelType {
  const typeField = frame.fields.find((field) => field.name === 'labelTypes')?.values[index];
  if (!typeField) {
    return null;
  }
  switch (typeField[labelKey]) {
    case 'I':
      return LabelType.Indexed;
    case 'S':
      return LabelType.StructuredMetadata;
    case 'P':
      return LabelType.Parsed;
    default:
      return null;
  }
}
