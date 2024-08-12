import { DataFrame, FieldConfig, FieldMatcherID } from '@grafana/data';
import {
  FieldConfigOverridesBuilder,
  SceneDataProvider,
  SceneDataTransformer,
  SceneQueryRunner,
} from '@grafana/scenes';
import { map, Observable } from 'rxjs';
import { LokiQuery } from './query';
import { HideSeriesConfig } from '@grafana/schema';
import { WRAPPED_LOKI_DS_UID } from './datasource';
import { LogsSceneQueryRunner } from './LogsSceneQueryRunner';

const UNKNOWN_LEVEL_LOGS = 'logs';
export function setLeverColorOverrides(overrides: FieldConfigOverridesBuilder<FieldConfig>) {
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

export function getQueryRunner(queries: LokiQuery[]) {
  // if there's a legendFormat related to any `level` like label, we want to
  // sort the output equally. That's purposefully not `LEVEL_VARIABLE_VALUE`,
  // such that the `detected_level` graph looks the same as a graph for the
  // `level` label.

  const hasLevel = queries.find((query) => query.legendFormat?.toLowerCase().includes('level'));

  if (hasLevel) {
    return new SceneDataTransformer({
      $data: new SceneQueryRunner({
        datasource: { uid: WRAPPED_LOKI_DS_UID },
        queries: queries,
      }),
      transformations: [sortLevelTransformation],
    });
  }

  return new SceneQueryRunner({
    datasource: { uid: WRAPPED_LOKI_DS_UID },
    queries: queries,
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
