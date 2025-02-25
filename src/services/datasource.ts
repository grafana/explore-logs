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
import { config, DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { RuntimeDataSource, sceneUtils } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { Observable, Subscriber } from 'rxjs';
import { getDataSource } from './scenes';
import { DetectedFieldsResponse, DetectedLabelsResponse } from './fields';
import { FIELDS_TO_REMOVE, LABELS_TO_REMOVE, sortLabelsByCardinality } from './filters';
import { SERVICE_NAME } from './variables';
import { runShardSplitQuery } from './shardQuerySplitting';
import { requestSupportsSharding } from './logql';
import { LokiDatasource, LokiQuery } from './lokiQuery';
import { SceneDataQueryRequest, SceneDataQueryResourceRequest, VolumeRequestProps } from './datasourceTypes';
import { logger } from './logger';
import { PLUGIN_ID } from './plugin';
import { sanitizeStreamSelector } from './query';

export const WRAPPED_LOKI_DS_UID = 'wrapped-loki-ds-uid';

type TimeStampOfVolumeEval = number;
type VolumeCount = string;
type VolumeValue = [TimeStampOfVolumeEval, VolumeCount];
type VolumeResult = {
  metric: {
    service_name?: string;
    __aggregated_metric__?: string;
    [index: string]: string | undefined;
  };
  value: VolumeValue;
};

type IndexVolumeResponse = {
  data: {
    result: VolumeResult[];
  };
};

type LabelsResponse = {
  status: string;
  data: string[];
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

export const DETECTED_FIELDS_NAME_FIELD = 'name';

export const DETECTED_FIELDS_CARDINALITY_NAME = 'cardinality';

export const DETECTED_FIELDS_PARSER_NAME = 'parser';

export const DETECTED_FIELDS_TYPE_NAME = 'type';

export class WrappedLokiDatasource extends RuntimeDataSource<DataQuery> {
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
          if (!(ds instanceof DataSourceWithBackend) || !('interpolateString' in ds) || !('getTimeRangeParams' in ds)) {
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
            case 'detected_fields': {
              await this.getDetectedFields(request, ds, subscriber);
              break;
            }
            case 'labels': {
              await this.getLabels(request, ds, subscriber);
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

  private getData(request: SceneDataQueryRequest, ds: LokiDatasource, subscriber: Subscriber<DataQueryResponse>) {
    const shardingEnabled = config.featureToggles.exploreLogsShardSplitting;

    const updatedRequest = {
      ...request,
      targets: ds.interpolateVariablesInQueries(request.targets, request.scopedVars).map((target) => ({
        ...target,
        resource: undefined,
        expr: sanitizeStreamSelector(target.expr),
      })),
    };

    // Query the datasource and return either observable or promise
    const dsResponse =
      requestSupportsSharding(updatedRequest) === false || !shardingEnabled
        ? ds.query(updatedRequest)
        : runShardSplitQuery(ds, updatedRequest);
    dsResponse.subscribe(subscriber);

    return subscriber;
  }

  private async getPatterns(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: LokiDatasource,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    const targets = request.targets.filter((target) => {
      return target.resource === 'patterns';
    });

    if (targets.length !== 1) {
      throw new Error('Patterns query can only have a single target!');
    }
    const { interpolatedTarget, expression } = this.interpolate(ds, targets, request);
    subscriber.next({ data: [], state: LoadingState.Loading });

    try {
      const dsResponse = ds.getResource(
        'patterns',
        {
          query: expression,
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
          step: request.interval,
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
    ds: LokiDatasource,
    targets: Array<LokiQuery & SceneDataQueryResourceRequest>,
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>
  ) {
    const targetsInterpolated = ds.interpolateVariablesInQueries(targets, request.scopedVars);
    if (!targetsInterpolated.length) {
      throw new Error('Datasource failed to interpolate query!');
    }
    const interpolatedTarget = targetsInterpolated[0];
    const expression = sanitizeStreamSelector(interpolatedTarget.expr);
    return { interpolatedTarget, expression };
  }

  private async getDetectedLabels(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: LokiDatasource,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    const targets = request.targets.filter((target) => {
      return target.resource === 'detected_labels';
    });

    if (targets.length !== 1) {
      throw new Error('Detected labels query can only have a single target!');
    }

    let { interpolatedTarget, expression } = this.interpolate(ds, targets, request);

    // Detected_labels is a bit different then other queries that interpolate the labels variable, it can be empty, but if it is empty it must be completely empty or we'll get the "queries require at least one regexp or equality" error from Loki
    if (expression === `{}`) {
      expression = '';
    }

    subscriber.next({ data: [], state: LoadingState.Loading });

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
        ?.filter((label) => !LABELS_TO_REMOVE.includes(label.label))
        ?.sort((a, b) => sortLabelsByCardinality(a, b));

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

  private async getDetectedFields(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: LokiDatasource,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    const targets = request.targets.filter((target) => {
      return target.resource === 'detected_fields';
    });

    if (targets.length !== 1) {
      throw new Error('Detected fields query can only have a single target!');
    }

    subscriber.next({ data: [], state: LoadingState.Loading });

    const { interpolatedTarget, expression } = this.interpolate(ds, targets, request);

    try {
      const response = await ds.getResource<DetectedFieldsResponse>(
        'detected_fields',
        {
          query: expression,
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
        },
        {
          requestId: request.requestId ?? 'detected_fields',
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );

      const nameField: Field = { name: DETECTED_FIELDS_NAME_FIELD, type: FieldType.string, values: [], config: {} };
      const cardinalityField: Field = {
        name: DETECTED_FIELDS_CARDINALITY_NAME,
        type: FieldType.number,
        values: [],
        config: {},
      };
      const parserField: Field = { name: DETECTED_FIELDS_PARSER_NAME, type: FieldType.string, values: [], config: {} };
      const typeField: Field = { name: DETECTED_FIELDS_TYPE_NAME, type: FieldType.string, values: [], config: {} };

      response.fields?.forEach((field) => {
        if (!FIELDS_TO_REMOVE.includes(field.label)) {
          nameField.values.push(field.label);
          cardinalityField.values.push(field.cardinality);
          parserField.values.push(field.parsers?.length ? field.parsers.join(', ') : 'structuredMetadata');
          typeField.values.push(field.type);
        }
      });

      const dataFrame = createDataFrame({
        refId: interpolatedTarget.refId,
        fields: [nameField, cardinalityField, parserField, typeField],
      });

      subscriber.next({ data: [dataFrame], state: LoadingState.Done });
    } catch (e) {
      logger.error(e, { msg: 'Detected fields error' });
      subscriber.next({ data: [], state: LoadingState.Error });
    }

    return subscriber;
  }

  //@todo doesn't work with multiple queries
  private async getVolume(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest & VolumeRequestProps>,
    ds: LokiDatasource,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    if (request.targets.length !== 1) {
      throw new Error('Volume query can only have a single target!');
    }

    const target = request.targets[0];
    const primaryLabel = target.primaryLabel;
    if (!primaryLabel) {
      throw new Error('Primary label is required for volume queries!');
    }

    const targetsInterpolated = ds.interpolateVariablesInQueries([target], request.scopedVars);
    const expression = sanitizeStreamSelector(targetsInterpolated[0].expr.replace('.*.*', '.+'));

    subscriber.next({ data: [], state: LoadingState.Loading });

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
          {
            // @todo rename
            name: SERVICE_NAME,
            values: volumeResponse?.data.result?.map((r) => {
              return r.metric[primaryLabel];
            }),
          },
          { name: 'volume', values: volumeResponse?.data.result?.map((r) => Number(r.value[1])) },
        ],
      });

      subscriber.next({ data: [df] });
    } catch (e) {
      logger.error(e);
      subscriber.next({ data: [], state: LoadingState.Error });
    }

    subscriber.complete();

    return subscriber;
  }

  private async getLabels(
    request: DataQueryRequest<LokiQuery & SceneDataQueryResourceRequest>,
    ds: LokiDatasource,
    subscriber: Subscriber<DataQueryResponse>
  ) {
    if (request.targets.length !== 1) {
      throw new Error('Volume query can only have a single target!');
    }

    try {
      const labelsResponse: LabelsResponse = await ds.getResource(
        'labels',
        {
          start: request.range.from.utc().toISOString(),
          end: request.range.to.utc().toISOString(),
        },
        {
          requestId: request.requestId ?? 'labels',
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );

      // Scenes will only emit dataframes from the SceneQueryRunner, so for now we need to convert the API response to a dataframe
      const df = createDataFrame({
        fields: [{ name: 'labels', values: labelsResponse?.data }],
      });
      subscriber.next({ data: [df], state: LoadingState.Done });
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

function init() {
  sceneUtils.registerRuntimeDataSource({
    dataSource: new WrappedLokiDatasource('wrapped-loki-ds', WRAPPED_LOKI_DS_UID),
  });
}

export default init;
