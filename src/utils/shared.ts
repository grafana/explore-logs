import { BusEventBase } from '@grafana/data';
import { SceneObject } from '@grafana/scenes';

export type ActionViewType = 'logs' | 'labels' | 'patterns' | 'fields' | 'traces' | 'relatedMetrics';
export interface ActionViewDefinition {
  displayName: string;
  value: ActionViewType;
  getScene: (changeFields: (f: string[]) => void) => SceneObject;
}

export const EXPLORATIONS_ROUTE = '/a/grafana-explorelogs-app/explore';

export const VAR_FILTERS = 'filters';
export const VAR_FILTERS_EXPR = '${filters}';
export const VAR_FIELDS = 'fields';
export const VAR_FIELDS_EXPR = '${fields}';
export const VAR_PATTERNS = 'patterns';
export const VAR_PATTERNS_EXPR = '${patterns}';
export const VAR_FIELD_GROUP_BY = 'fieldBy';
export const VAR_LABEL_GROUP_BY = 'labelBy';
export const VAR_DATASOURCE = 'ds';
export const VAR_DATASOURCE_EXPR = '${ds}';
export const VAR_LOGS_FORMAT = 'logsFormat';
export const VAR_LOGS_FORMAT_EXPR = '${logsFormat}';
export const VAR_LINE_FILTER = 'lineFilter';
export const VAR_LINE_FILTER_EXPR = '${lineFilter}'

export const LOG_STREAM_SELECTOR_EXPR = `${VAR_FILTERS_EXPR} ${VAR_PATTERNS_EXPR} ${VAR_LOGS_FORMAT_EXPR} ${VAR_FIELDS_EXPR} ${VAR_LINE_FILTER_EXPR}`;
export const explorationDS = { uid: VAR_DATASOURCE_EXPR };

export const ALL_VARIABLE_VALUE = '$__all';

export type MakeOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export class StartingPointSelectedEvent extends BusEventBase {
  public static type = 'start-point-selected-event';
}

export class DetailsSceneUpdated extends BusEventBase {
  public static type = 'details-scene-updated';
}
