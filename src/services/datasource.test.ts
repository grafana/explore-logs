import { SceneDataQueryResourceRequest, WrappedLokiDatasource } from './datasource';
import { DataFrame, DataQueryRequest, DataQueryResponse, DataSourcePluginMeta, dateTime } from '@grafana/data';
import { LokiQuery } from './query';
import { Observable } from 'rxjs';
import { DataSourceWithBackend } from '@grafana/runtime';
import { DetectedFieldsResponse } from './fields';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(() => {
    return {
      get: (ds: DataSourceWithBackend) => Promise.resolve(ds),
    };
  }),
}));

let datasource = new DataSourceWithBackend<LokiQuery>({
  name: '',
  type: '',
  access: 'direct',
  id: 0,
  jsonData: {},
  meta: {} as DataSourcePluginMeta,
  readOnly: false,
  uid: '',
}) as DataSourceWithBackend<LokiQuery>;

jest.mock('./scenes', () => ({
  ...jest.requireActual('./scenes'),
  getDataSource: () => datasource,
}));
describe('datasource', () => {
  describe('detected_fields', () => {
    beforeEach(() => {
      const detectedFieldsResponse = {
        fields: [
          {
            label: 'caller',
            type: 'string',
            cardinality: 2,
            parsers: ['logfmt'],
          },
          {
            label: 'detected_level',
            type: 'string',
            cardinality: 4,
            parsers: ['logfmt'],
          },
        ],
      };

      // @ts-ignore
      datasource.getResource = (path, params, options) => {
        const detectedFieldResponse: DetectedFieldsResponse = detectedFieldsResponse;
        return Promise.resolve(detectedFieldResponse);
      };
    });
    it('should strip out detected_level', (done) => {
      const datasource = new WrappedLokiDatasource('logs-explore', 'abc-123');
      const request = {
        app: 'logs-explore',
        range: {
          from: dateTime(),
          to: dateTime(),
          raw: {
            from: dateTime(),
            to: dateTime(),
          },
        },
        scopedVars: {
          __sceneObject: {},
        },
        targets: [
          {
            expr: '',
            refId: '',
            datasource: '',
            resource: 'detected_fields',
            queryType: '',
            editorMode: 'code',
            supportingQueryType: '',
          },
        ],
      } as unknown as DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>;
      const response = datasource.query(request) as Observable<DataQueryResponse>;

      response.subscribe((value) => {
        const dataFrame: DataFrame = value.data[0];
        expect(dataFrame.fields[0].values).toEqual(['caller']);
        expect(dataFrame.fields[1].values).toEqual([2]);
        expect(dataFrame.fields[2].values).toEqual(['logfmt']);
        done();
      });
    });
  });
});
