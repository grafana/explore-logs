import { SceneFlexItem, SceneFlexLayout, SceneObject } from '@grafana/scenes';
import { getFieldsVariable, getLogsStreamSelector, LEVEL_VARIABLE_VALUE } from './variables';
import { getParserFromFieldsFilters } from './fields';
import { buildDataQuery } from './query';
import { LabelBreakdownScene } from '../Components/ServiceScene/Breakdowns/LabelBreakdownScene';

export const LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

export function buildLabelValuesBreakdownActionScene(value: string) {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({ value }),
      }),
    ],
  });
}

export function buildLabelsQuery(sceneRef: SceneObject, optionValue: string, optionName: string) {
  let labelExpressionToAdd = '';
  let structuredMetadataToAdd = '';

  const fields = getFieldsVariable(sceneRef);
  const parser = getParserFromFieldsFilters(fields);

  if (optionName && optionName !== LEVEL_VARIABLE_VALUE) {
    labelExpressionToAdd = ` ,${optionName} != ""`;
  } else if (optionName && optionName === LEVEL_VARIABLE_VALUE) {
    structuredMetadataToAdd = ` | ${optionName} != ""`;
  }

  return buildDataQuery(
    `sum(count_over_time(${getLogsStreamSelector({
      labelExpressionToAdd,
      structuredMetadataToAdd,
      parser,
    })} [$__auto])) by (${optionValue})`,
    { legendFormat: `{{${optionValue}}}`, refId: 'LABEL_BREAKDOWN_VALUES' }
  );
}
