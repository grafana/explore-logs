import { PageSlugs, ValueSlugs } from '../../services/routing';
import { buildLogsListScene } from './LogsListScene';
import { testIds } from '../../services/testIds';
import { buildLabelBreakdownActionScene, buildLabelValuesBreakdownActionScene } from './Breakdowns/LabelBreakdownScene';
import {
  buildFieldsBreakdownActionScene,
  buildFieldValuesBreakdownActionScene,
} from './Breakdowns/FieldsBreakdownScene';
import { buildPatternsScene } from './Breakdowns/Patterns/PatternsBreakdownScene';
import { SceneObject } from '@grafana/scenes';

interface ValueBreakdownViewDefinition {
  displayName: string;
  value: ValueSlugs;
  testId: string;
  getScene: (value: string) => SceneObject;
}

export interface BreakdownViewDefinition {
  displayName: string;
  value: PageSlugs;
  testId: string;
  getScene: (changeFields: (f: string[]) => void) => SceneObject;
}

export const breakdownViewsDefinitions: BreakdownViewDefinition[] = [
  {
    displayName: 'Logs',
    value: PageSlugs.logs,
    getScene: () => buildLogsListScene(),
    testId: testIds.exploreServiceDetails.tabLogs,
  },
  {
    displayName: 'Labels',
    value: PageSlugs.labels,
    getScene: () => buildLabelBreakdownActionScene(),
    testId: testIds.exploreServiceDetails.tabLabels,
  },
  {
    displayName: 'Fields',
    value: PageSlugs.fields,
    getScene: (f) => buildFieldsBreakdownActionScene(f),
    testId: testIds.exploreServiceDetails.tabFields,
  },
  {
    displayName: 'Patterns',
    value: PageSlugs.patterns,
    getScene: () => buildPatternsScene(),
    testId: testIds.exploreServiceDetails.tabPatterns,
  },
];
export const valueBreakdownViews: ValueBreakdownViewDefinition[] = [
  {
    displayName: 'Label',
    value: ValueSlugs.label,
    getScene: (value: string) => buildLabelValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabLabels,
  },
  {
    displayName: 'Field',
    value: ValueSlugs.field,
    getScene: (value: string) => buildFieldValuesBreakdownActionScene(value),
    testId: testIds.exploreServiceDetails.tabFields,
  },
];
