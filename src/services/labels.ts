import { SceneObject } from '@grafana/scenes';
import { LEVEL_VARIABLE_VALUE, VAR_LABELS } from './variables';
import { getParserFromFieldsFilters } from './fields';
import { buildDataQuery } from './query';
import { getFieldsVariable, getLabelsVariable, getLogsStreamSelector } from './variableGetters';
import { addToFilters, FilterType } from '../Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { isOperatorExclusive, isOperatorInclusive } from './operatorHelpers';
import { getLabelValueFromDataFrame } from './levels';
import { DataFrame } from '@grafana/data';

export const LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

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

export function getLabelsFromSeries(series: DataFrame[]): string[] {
  const labels = series.map((dataFrame) => getLabelValueFromDataFrame(dataFrame));
  return labels.flatMap((f) => (f ? [f] : []));
}

export function toggleLabelFromFilter(key: string, value: string, sceneRef: SceneObject): FilterType {
  const labelsVariable = getLabelsVariable(sceneRef);
  const empty = labelsVariable.state.filters.length === 0;
  const filterExists = labelsVariable.state.filters.find(
    (filter) => filter.value === value && isOperatorInclusive(filter.operator)
  );

  if (empty || !filterExists) {
    addToFilters(key, value, 'include', sceneRef, VAR_LABELS);
    return 'include';
  } else {
    addToFilters(key, value, 'toggle', sceneRef, VAR_LABELS);
    return 'toggle';
  }
}

export function getVisibleLabels(key: string, allLabels: string[], sceneRef: SceneObject) {
  const labelsVariable = getLabelsVariable(sceneRef);
  const inclusiveFilters = labelsVariable.state.filters
    .filter((filter) => filter.key === key && isOperatorInclusive(filter.operator))
    .map((filter) => filter.value.split('|'))
    .join('|');
  const exclusiveLabels = labelsVariable.state.filters
    .filter((filter) => filter.key === key && isOperatorExclusive(filter.operator))
    .map((filter) => filter.value.split('|'))
    .join('|');

  return allLabels.filter((label) => {
    if (exclusiveLabels.includes(label)) {
      return false;
    }
    return inclusiveFilters.length === 0 || inclusiveFilters.includes(label);
  });
}
