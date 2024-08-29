import {
  createDataFrame,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  Field,
  FieldType,
  LoadingState,
  TestDataSourceResponse,
} from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, SceneObject, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Observable, Subscriber } from 'rxjs';
import { getDataSource } from './scenes';
import { LokiQuery } from './query';
import { PLUGIN_ID } from './routing';
import { DetectedLabelsResponse } from './fields';
import { sortLabelsByCardinality } from './filters';
import { LEVEL_VARIABLE_VALUE, SERVICE_NAME } from './variables';
import { runShardSplitQuery } from './shardQuerySplitting';
import { isLogsRequest } from './logql';

export const WRAPPED_LOKI_DS_UID = 'wrapped-loki-ds-uid';

export type SceneDataQueryRequest = DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest> & {
  scopedVars?: { __sceneObject?: { valueOf: () => SceneObject } };
};

export type SceneDataQueryResourceRequest = {
  resource: 'volume' | 'patterns' | 'detected_labels';
};
type TimeStampOfVolumeEval = number;
type VolumeCount = string;
type VolumeValue = [TimeStampOfVolumeEval, VolumeCount];
type VolumeResult = {
  metric: {
    service_name: string;
  };
  value: VolumeValue;
};

type IndexVolumeResponse = {
  data: {
    result: VolumeResult[];
  };
};

type SampleTimeStamp = number;
type SampleCount = number;
type PatternSample = [SampleTimeStamp, SampleCount];

export interface LokiPattern {
  pattern: string;
  samples: PatternSample[];
}

type PatternsResponse = {
  data: LokiPattern[];
};

class WrappedLokiDatasource extends RuntimeDataSource<DataQuery> {
  constructor(pluginId: string, uid: string) {
    super(pluginId, uid);
  }

  query(request: SceneDataQueryRequest): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((subscriber) => {
      if (!request.scopedVars?.__sceneObject) {
        throw new Error('Scene object not found in request');
      }

      getDataSourceSrv()
        .get(getDataSource(request.scopedVars.__sceneObject.valueOf()))
        .then(async (ds) => {
          if (!(ds instanceof DataSourceWithBackend)) {
            throw new Error('Invalid datasource!');
          }

          // override the target datasource to Loki
          request.targets = request.targets?.map((target) => {
            target.datasource = ds;
            return target;
          });

          const targetsSet = new Set();
          request.targets.forEach((target) => {
            targetsSet.add(target.resource ?? '');
          });

          if (targetsSet.size !== 1) {
            throw new Error('A request cannot contain queries to multiple endpoints');
          }

          const requestType = request.targets[0].resource;

          switch (requestType) {
            case 'volume': {
              await this.getVolume(request, ds, subscriber);
              break;
            }
            case 'patterns': {
              await this.getPatterns(request, ds, subscriber);
              break;
            }
            case 'detected_labels': {
              await this.getDetectedLabels(request, ds, subscriber);
              break;
            }
            default: {
              this.getData(request, ds, subscriber);
              break;
            }
          }
        });
    });
  }

  private getData(
    request: SceneDataQueryRequest,
    ds: DataSourceWithBackend<LokiQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    // query the datasource and return either observable or promise
    const dsResponse = isLogsRequest(request) ? ds.query(request) : runShardSplitQuery(ds, request);
    dsResponse.subscribe(subscriber);

    return subscriber;
  }

  private async getPatterns(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: DataSourceWithBackend<LokiQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    const targets = request.targets.filter((target) => {
      return target.resource === 'patterns';
    });

    if (targets.length !== 1) {
      throw new Error('Patterns query can only have a single target!');
    }
    const { interpolatedTarget, expression } = this.interpolate(ds, targets, request);

    try {
      const dsResponse = ds.getResource(
        'patterns',
        {
          query: expression,
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
        },
        {
          requestId: request.requestId ?? 'patterns',
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      const response: PatternsResponse = await dsResponse;
      const lokiPatterns = response?.data;

      let maxValue = -Infinity;
      let minValue = 0;

      const frames: DataFrame[] =
        lokiPatterns?.map((pattern: LokiPattern) => {
          const timeValues: number[] = [];
          const countValues: number[] = [];
          let sum = 0;
          pattern.samples.forEach(([time, count]) => {
            timeValues.push(time * 1000);
            countValues.push(count);
            if (count > maxValue) {
              maxValue = count;
            }
            if (count < minValue) {
              minValue = count;
            }
            if (count > maxValue) {
              maxValue = count;
            }
            if (count < minValue) {
              minValue = count;
            }
            sum += count;
          });
          return createDataFrame({
            refId: interpolatedTarget.refId,
            name: pattern.pattern,
            fields: [
              {
                name: 'time',
                type: FieldType.time,
                values: timeValues,
                config: {},
              },
              {
                name: pattern.pattern,
                type: FieldType.number,
                values: countValues,
                config: {},
              },
            ],
            meta: {
              preferredVisualisationType: 'graph',
              custom: {
                sum,
              },
            },
          });
        }) ?? [];

      frames.sort((a, b) => (b.meta?.custom?.sum as number) - (a.meta?.custom?.sum as number));
      subscriber.next({ data: frames, state: LoadingState.Done });
    } catch (e) {
      subscriber.next({ data: [], state: LoadingState.Error });
    }

    return subscriber;
  }

  private interpolate(
    ds: DataSourceWithBackend<LokiQuery>,
    targets: Array<LokiQuery & SceneDataQueryResourceRequest>,
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>
  ) {
    const targetsInterpolated = ds.interpolateVariablesInQueries(targets, request.scopedVars);
    if (!targetsInterpolated.length) {
      throw new Error('Datasource failed to interpolate query!');
    }
    const interpolatedTarget = targetsInterpolated[0];
    const expression = interpolatedTarget.expr;
    return { interpolatedTarget, expression };
  }

  private async getDetectedLabels(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: DataSourceWithBackend<LokiQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    const targets = request.targets.filter((target) => {
      return target.resource === 'detected_labels';
    });

    if (targets.length !== 1) {
      throw new Error('Detected labels query can only have a single target!');
    }

    const { interpolatedTarget, expression } = this.interpolate(ds, targets, request);

    try {
      const response = await ds.getResource<DetectedLabelsResponse>(
        'detected_labels',
        {
          query: expression,
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
        },
        {
          requestId: request.requestId ?? 'detected_labels',
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      const labels = response.detectedLabels
        ?.sort((a, b) => sortLabelsByCardinality(a, b))
        ?.filter((label) => label.label !== LEVEL_VARIABLE_VALUE);

      const detectedLabelFields: Array<Partial<Field>> = labels?.map((label) => {
        return {
          name: label.label,
          values: [label.cardinality],
        };
      });

      const dataFrame = createDataFrame({
        refId: interpolatedTarget.refId,
        fields: detectedLabelFields ?? [],
      });

      subscriber.next({ data: [dataFrame], state: LoadingState.Done });
    } catch (e) {
      subscriber.next({ data: [], state: LoadingState.Error });
    }

    return subscriber;
  }

  //@todo doesn't work with multiple queries
  private async getVolume(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: DataSourceWithBackend<LokiQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    if (request.targets.length !== 1) {
      throw new Error('Volume query can only have a single target!');
    }

    const targetsInterpolated = ds.interpolateVariablesInQueries(request.targets, request.scopedVars);
    const expression = targetsInterpolated[0].expr.replace('.*.*', '.+');

    try {
      const volumeResponse: IndexVolumeResponse = await ds.getResource(
        'index/volume',
        {
          query: expression,
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
          limit: 5000,
        },
        {
          requestId: request.requestId ?? 'volume',
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      volumeResponse?.data.result.sort((lhs: VolumeResult, rhs: VolumeResult) => {
        const lVolumeCount: VolumeCount = lhs.value[1];
        const rVolumeCount: VolumeCount = rhs.value[1];
        return Number(rVolumeCount) - Number(lVolumeCount);
      });
      // Scenes will only emit dataframes from the SceneQueryRunner, so for now we need to convert the API response to a dataframe
      const df = createDataFrame({
        fields: [
          { name: SERVICE_NAME, values: volumeResponse?.data.result?.map((r) => r.metric.service_name) },
          { name: 'volume', values: volumeResponse?.data.result?.map((r) => Number(r.value[1])) },
        ],
      });
      subscriber.next({ data: [df] });
    } catch (e) {
      subscriber.next({ data: [], state: LoadingState.Error });
    }

    subscriber.complete();

    return subscriber;
  }

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'Data source is working', title: 'Success' });
  }
}

export function init() {
  sceneUtils.registerRuntimeDataSource({
    dataSource: new WrappedLokiDatasource('wrapped-loki-ds', WRAPPED_LOKI_DS_UID),
  });
}
