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

/**
 * Calculates the cardinality of labels on dataframe
 * This function iterates through every label/value pair and organizes them into a map indexed by label name containing sets of values
 * This can be a relatively expensive calculation, depending on the label set; especially if there are many unique labels
 * Instantiating a new set on every iteration (else in inner loop) is the worst case behavior
 * @param labels
 */
export function getLabelCardinalityMap(labels: Labels[] | undefined) {
  const cardinalityMap = new Map<labelName, { valueSet: Set<labelValue> }>();

  if (labels) {
    for (let i = 0; i < labels.length; i++) {
      const fieldLabels = labels?.[i];
      const labelNames = Object.keys(fieldLabels);
      for (let j = 0; j < labelNames.length; j++) {
        const labelName = labelNames[j];
        if (cardinalityMap.has(labelName)) {
          const setObj = cardinalityMap.get(labelName);
          const values = setObj?.valueSet;

          if (values && !values?.has(fieldLabels[labelName])) {
            values?.add(fieldLabels[labelName]);
          }
        } else {
          cardinalityMap.set(labelName, {
            valueSet: new Set([fieldLabels[labelName]]),
          });
        }
      }
    }
  }

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
