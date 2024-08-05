import { createDataFrame, DataQueryRequest, DataQueryResponse, TestDataSourceResponse } from '@grafana/data';
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

          const requestType = request.targets?.[0]?.resource;

          switch (requestType) {
            case 'volume': {
              this.getVolume(request, ds, subscriber);
              break;
            }
            case 'patterns': {
              console.warn('not yet implemented');
              // this.transformPatternResponse(request, ds, subscriber);
              break;
            }
            default: {
              // override the target datasource to Loki
              request.targets = request.targets.map((target) => {
                target.datasource = ds;
                return target;
              });

              // query the datasource and return either observable or promise
              const dsResponse = ds.query(request);
              dsResponse.subscribe(subscriber);
              break;
            }
          }
        });
    });
  }

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
        from: request.range.from.utc().toISOString(),
        to: request.range.to.utc().toISOString(),
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
