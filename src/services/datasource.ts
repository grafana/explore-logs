import {DataQueryRequest, DataQueryResponse, TestDataSourceResponse} from '@grafana/data';
import {DataSourceWithBackend, getDataSourceSrv} from '@grafana/runtime';
import {RuntimeDataSource, SceneObject, sceneUtils} from '@grafana/scenes';
import {DataQuery} from '@grafana/schema';
import {Observable} from 'rxjs';
import {getDataSource} from './scenes';
import {LokiQuery} from "./query";
import {PLUGIN_ID} from "./routing";

export const WRAPPED_LOKI_DS_UID = 'wrapped-loki-ds-uid';

export type SceneDataQueryRequest = DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest> & {
  scopedVars?: { __sceneObject?: { valueOf: () => SceneObject } };
}

export type SceneDataQueryResourceRequest = {
  resource?: 'volume' | 'patterns' | 'detected_labels'
}
type TimeStampOfVolumeEval = number
type VolumeCount = string;

type IndexVolumeResponse = {
  data: {
    result: Array<{
      metric: {
        service_name: string
      },
      value: [TimeStampOfVolumeEval, VolumeCount]
    }>
  }
}

class WrappedLokiDatasource extends RuntimeDataSource<DataQuery> {
  constructor(pluginId: string, uid: string) {
    super(pluginId, uid);
  }

  query(request: SceneDataQueryRequest): Promise<DataQueryResponse> | Observable<DataQueryResponse> | Promise<IndexVolumeResponse> {
    console.log('request', request)

    return new Observable<DataQueryResponse>((subscriber) => {
      if (!request.scopedVars?.__sceneObject) {
        throw new Error('Scene object not found in request');
      }

      getDataSourceSrv()
        .get(getDataSource(request.scopedVars.__sceneObject.valueOf()))
        .then((ds) => {
          if(!(ds instanceof DataSourceWithBackend)){
            throw new Error('Invalid datasource!')
          }

          const requestType = request.targets?.[0]?.resource

          switch(requestType) {
            case "volume": {
              console.log('volume', request)
              if(request.targets.length !== 1){
                throw new Error('Volume query can only have a single target!')
              }
              const dsResponse = ds.getResource('index/volume', {
                query: request.targets[0].expr,
                from: request.range.from.utc().toISOString(),
                to: request.range.to.utc().toISOString(),
                limit: 1000
              }, {
                headers: {
                  'X-Query-Tags': `Source=${PLUGIN_ID}`,
                },
              })
              dsResponse.then((response: IndexVolumeResponse | undefined) => {
                console.log('dsResponse', response)
                subscriber.next(response);
                subscriber.complete();
              });
              break
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

  testDatasource(): Promise<TestDataSourceResponse> {
    return Promise.resolve({ status: 'success', message: 'Data source is working', title: 'Success' });
  }
}

export function init() {
  sceneUtils.registerRuntimeDataSource({
    dataSource: new WrappedLokiDatasource('wrapped-loki-ds', WRAPPED_LOKI_DS_UID),
  });
}
