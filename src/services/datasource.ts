import {
  createDataFrame,
  DataQueryRequest,
  DataQueryResponse,
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
        .then((ds) => {
          if (!(ds instanceof DataSourceWithBackend)) {
            throw new Error('Invalid datasource!');
          }

          // override the target datasource to Loki
          request.targets = request.targets.map((target) => {
            target.datasource = ds;
            return target;
          });

          const targetsSet = new Set();
          request.targets.forEach((target) => {
            targetsSet.add(target.resource);
          });

          if (targetsSet.size !== 1) {
            throw new Error('A request cannot contain queries to multiple endpoints');
          }

          request.targets.forEach((target) => {
            const requestType = target?.resource;

            switch (requestType) {
              case 'volume': {
                this.getVolume(request, ds, subscriber);
                break;
              }
              case 'patterns': {
                this.getPatterns(request, ds, subscriber);
                break;
              }
              default: {
                this.getData(request, ds, subscriber);
                break;
              }
            }
          });
        });
    });
  }

  private getData(
    request: SceneDataQueryRequest,
    ds: DataSourceWithBackend<DataQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    // query the datasource and return either observable or promise
    const dsResponse = ds.query(request);
    dsResponse.subscribe(subscriber);

    return subscriber;
  }

  private getPatterns(
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

    const targetsInterpolated = ds.interpolateVariablesInQueries(targets, request.scopedVars);
    const interpolatedTarget = targetsInterpolated[0];
    const expression = interpolatedTarget.expr;

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
    dsResponse.then((response: PatternsResponse | undefined) => {
      const lokiPatterns = response?.data;

      let maxValue = -Infinity;
      let minValue = 0;

      const frames =
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
    });

    return subscriber;
  }

  //@todo doesn't work with multiple queries
  private getVolume(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: DataSourceWithBackend<LokiQuery>,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    if (request.targets.length !== 1) {
      throw new Error('Volume query can only have a single target!');
    }

    const targetsInterpolated = ds.interpolateVariablesInQueries(request.targets, request.scopedVars);
    const expression = targetsInterpolated[0].expr.replace('.*.*', '.+');

    const dsResponse = ds.getResource(
      'index/volume',
      {
        query: expression,
        start: request.range.from.utc().toISOString(),
        end: request.range.to.utc().toISOString(),
        limit: 1000,
      },
      {
        requestId: request.requestId ?? 'volume',
        headers: {
          'X-Query-Tags': `Source=${PLUGIN_ID}`,
        },
      }
    );
    dsResponse.then((response: IndexVolumeResponse | undefined) => {
      response?.data.result.sort((lhs: VolumeResult, rhs: VolumeResult) => {
        const lVolumeCount: VolumeCount = lhs.value[1];
        const rVolumeCount: VolumeCount = rhs.value[1];
        return Number(rVolumeCount) - Number(lVolumeCount);
      });
      // Scenes will only emit dataframes from the SceneQueryRunner, so for now we need to convert the API response to a dataframe
      const df = createDataFrame({
        fields: [
          { name: 'service_name', values: response?.data.result.map((r) => r.metric.service_name) },
          { name: 'volume', values: response?.data.result.map((r) => Number(r.value[1])) },
        ],
      });
      subscriber.next({ data: [df] });
      subscriber.complete();
    });

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
