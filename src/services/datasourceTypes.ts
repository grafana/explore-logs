import { DataQueryRequest } from '@grafana/data';
import { LokiQuery } from './lokiQuery';
import { SceneObject } from '@grafana/scenes';

export type SceneDataQueryRequest = DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest> & {
  scopedVars?: { __sceneObject?: { valueOf: () => SceneObject } };
};
export type SceneDataQueryResourceRequest = {
  resource: 'volume' | 'patterns' | 'detected_labels' | 'detected_fields' | 'labels';
};
