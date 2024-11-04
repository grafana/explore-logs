import { DataFrame, FieldConfig, FieldMatcherID } from '@grafana/data';
import {
  FieldConfigBuilder,
  FieldConfigBuilders,
  FieldConfigOverridesBuilder,
  PanelBuilders,
  QueryRunnerState,
  SceneDataProvider,
  SceneDataTransformer,
  SceneObject,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { map, Observable } from 'rxjs';
import { HideSeriesConfig } from '@grafana/schema';
import { WRAPPED_LOKI_DS_UID } from './datasource';
import { LogsSceneQueryRunner } from './LogsSceneQueryRunner';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { getLabelsFromSeries, getVisibleLevels } from './levels';
import { LokiQuery } from './lokiQuery';

const UNKNOWN_LEVEL_LOGS = 'logs';
export function setLevelColorOverrides(overrides: FieldConfigOverridesBuilder<FieldConfig>) {
  overrides.matchFieldsWithName('info').overrideColor({
    mode: 'fixed',
    fixedColor: 'semi-dark-green',
  });
  overrides.matchFieldsWithName('debug').overrideColor({
    mode: 'fixed',
    fixedColor: 'semi-dark-blue',
  });
  overrides.matchFieldsWithName('error').overrideColor({
    mode: 'fixed',
    fixedColor: 'semi-dark-red',
  });
  overrides.matchFieldsWithName('warn').overrideColor({
    mode: 'fixed',
    fixedColor: 'semi-dark-orange',
  });
  overrides.matchFieldsWithName('logs').overrideColor({
    mode: 'fixed',
    fixedColor: 'darkgray',
  });
}

export function setLogsVolumeFieldConfigs(
  builder: ReturnType<typeof PanelBuilders.timeseries> | ReturnType<typeof FieldConfigBuilders.timeseries>
) {
  return builder
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setOverrides(setLevelColorOverrides);
}

interface TimeSeriesFieldConfig extends FieldConfig {
  hideFrom: HideSeriesConfig;
}

export function setLevelSeriesOverrides(levels: string[], overrideConfig: FieldConfigOverridesBuilder<FieldConfig>) {
  overrideConfig
    .match({
      id: FieldMatcherID.byNames,
      options: {
        mode: 'exclude',
        names: levels,
        prefix: 'All except:',
        readOnly: true,
      },
    })
    .overrideCustomFieldConfig<TimeSeriesFieldConfig, 'hideFrom'>('hideFrom', {
      legend: false,
      tooltip: false,
      viz: true,
    });

  // Setting __systemRef to hideSeriesFrom, allows the override to be changed by interacting with the viz
  const overrides = overrideConfig.build();
  // @ts-expect-error
  overrides[overrides.length - 1].__systemRef = 'hideSeriesFrom';
}

export function syncLogsPanelVisibleSeries(panel: VizPanel, series: DataFrame[], sceneRef: SceneObject) {
  const focusedLevels = getVisibleLevels(getLabelsFromSeries(series), sceneRef);
  if (focusedLevels?.length) {
    const config = setLogsVolumeFieldConfigs(FieldConfigBuilders.timeseries()).setOverrides(
      setLevelSeriesOverrides.bind(null, focusedLevels)
    );
    if (config instanceof FieldConfigBuilder) {
      panel.onFieldConfigChange(config.build(), true);
    }
  }
}

export function sortLevelTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data
          .map((d) => {
            if (!d.fields[1].config.displayNameFromDS) {
              d.fields[1].config.displayNameFromDS = UNKNOWN_LEVEL_LOGS;
            }
            return d;
          })
          .sort((a, b) => {
            const aName: string | undefined = a.fields[1].config.displayNameFromDS;
            const aVal = aName?.includes('error') ? 4 : aName?.includes('warn') ? 3 : aName?.includes('info') ? 2 : 1;
            const bName: string | undefined = b.fields[1].config.displayNameFromDS;
            const bVal = bName?.includes('error') ? 4 : bName?.includes('warn') ? 3 : bName?.includes('info') ? 2 : 1;
            return aVal - bVal;
          });
      })
    );
  };
}

export function getResourceQueryRunner(queries: LokiQuery[]) {
  return new LogsSceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: queries,
  });
}

export function getQueryRunner(queries: LokiQuery[], queryRunnerOptions?: Partial<QueryRunnerState>) {
  // if there's a legendFormat related to any `level` like label, we want to
  // sort the output equally. That's purposefully not `LEVEL_VARIABLE_VALUE`,
  // such that the `detected_level` graph looks the same as a graph for the
  // `level` label.

  const hasLevel = queries.find((query) => query.legendFormat?.toLowerCase().includes('level'));

  if (hasLevel) {
    return new SceneDataTransformer({
      $data: getSceneQueryRunner({
        datasource: { uid: WRAPPED_LOKI_DS_UID },
        queries: queries,
        ...queryRunnerOptions,
      }),
      transformations: [sortLevelTransformation],
    });
  }

  return getSceneQueryRunner({
    queries: queries,
    ...queryRunnerOptions,
  });
}

export function getSceneQueryRunner(queryRunnerOptions?: Partial<QueryRunnerState>) {
  return new SceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: [],
    ...queryRunnerOptions,
  });
}

export function getQueryRunnerFromProvider(provider: SceneDataProvider): SceneQueryRunner {
  if (provider instanceof SceneQueryRunner) {
    return provider;
  }

  if (provider.state.$data instanceof SceneQueryRunner) {
    return provider.state.$data;
  }

  throw new Error('SceneDataProvider is missing SceneQueryRunner');
}
