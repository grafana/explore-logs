import { DataQueryRequest, DataQueryResponse, TestDataSourceResponse } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, SceneObject, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Observable, isObservable } from 'rxjs';
import { getDataSource } from './scenes';

export const WRAPPED_LOKI_DS_UID = 'wrapped-loki-ds-uid';

type SceneDataQueryRequest = DataQueryRequest<DataQuery> & {
  scopedVars: { __sceneObject: { valueOf: () => SceneObject } };
};

class WrappedLokiDatasource extends RuntimeDataSource<DataQuery> {
  constructor(pluginId: string, uid: string) {
    super(pluginId, uid);
  }

  query(request: SceneDataQueryRequest): Promise<DataQueryResponse> | Observable<DataQueryResponse> {
    return new Observable<DataQueryResponse>((subscriber) => {
      getDataSourceSrv()
        .get(getDataSource(request.scopedVars.__sceneObject.valueOf()))
        .then((ds) => {
          // override the target datasource to Loki
          request.targets = request.targets.map((target) => {
            target.datasource = ds;
            return target;
          });

          // query the datasource and return either observable or promise
          const dsResponse = ds.query(request);
          if (isObservable(dsResponse)) {
            dsResponse.subscribe(subscriber);
          } else {
            dsResponse.then((response) => {
              subscriber.next(response);
              subscriber.complete();
            });
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
