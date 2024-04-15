import { DataFrame, Labels, PanelData } from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { PanelBuilders, SceneCSSGridItem, SceneDataNode } from '@grafana/scenes';
import { getColorByIndex } from './utils';
import { AddToFiltersGraphAction } from '../components/Explore/AddToFiltersGraphAction';
import { VAR_FIELDS } from './shared';

export function extractFields(data: DataFrame) {
  const result: { type: 'logfmt' | 'json'; fields: string[] } = { type: 'logfmt', fields: [] };
  const labelTypesField = data.fields.find((f) => f.name === 'labelTypes');
  result.fields = Object.keys(
    labelTypesField?.values.reduce((acc: Record<string, boolean>, value: Record<string, string>) => {
      Object.entries(value)
        .filter(([_, v]) => v === 'P')
        .forEach(([k]) => (acc[k] = true));
      return acc;
    }, {}) || {}
  );

  const linesField = data.fields.find((f) => f.name === 'Line');
  result.type = linesField?.values[0]?.[0] === '{' ? 'json' : 'logfmt';

  return result;
}

type labelName = string;
type labelValue = string;

export function getCardinalityMapFromLabels(frame: DataFrame) {
  const labels = frame.fields.find((f) => f.name === 'labels')?.values as Labels[];

  const cardinalityMap = new Map<labelName, { valueSet: Set<labelValue>; maxLength: number }>();
  labels.forEach((fieldLabels) => {
    const labelNames = Object.keys(fieldLabels);
    labelNames.forEach((labelName) => {
      if (cardinalityMap.has(labelName)) {
        const setObj = cardinalityMap.get(labelName);
        const values = setObj?.valueSet;
        const maxLength = setObj?.maxLength;

        if (values && !values?.has(fieldLabels[labelName])) {
          values?.add(fieldLabels[labelName]);
          if (maxLength && fieldLabels[labelName].length > maxLength) {
            cardinalityMap.set(labelName, { maxLength: fieldLabels[labelName].length, valueSet: values });
          }
        }
      } else {
        cardinalityMap.set(labelName, {
          maxLength: fieldLabels[labelName].length,
          valueSet: new Set([fieldLabels[labelName]]),
        });
      }
    });
  });

  return cardinalityMap;
}

export function getLayoutChild(getTitle: (df: DataFrame) => string, style: DrawStyle) {
  return (data: PanelData, frame: DataFrame, frameIndex: number) => {
    const panel = PanelBuilders.timeseries() //
      .setOption('legend', { showLegend: false })
      .setCustomFieldConfig('fillOpacity', 9)
      .setTitle(getTitle(frame))
      .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setHeaderActions(new AddToFiltersGraphAction({ frame, variableName: VAR_FIELDS }));
    // TODO hack
    if (style === DrawStyle.Bars) {
      panel
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars);
    }
    return new SceneCSSGridItem({
      body: panel.build(),
    });
  };
}
