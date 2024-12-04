import { DataFrame, FieldConfig, FieldMatcherID, FieldType, getFieldDisplayName } from '@grafana/data';
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
import { config } from '@grafana/runtime';
import { LOGS_PANEL_QUERY_REFID } from '../Components/ServiceScene/ServiceScene';

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

export function getColorByName(name: string, paletteSet: Set<number>) {
  const visTheme = config.theme2.visualization;
  const hash = Math.abs(getHash(name));
  const paletteSize = 57;
  // There are 56 colors in the palette, if we use more of the palette we're less likely to get duplicates, but the colors are harder to differntiate
  // Also, it's possible that a panel with N series has the same color for each series
  // See the birthday problem for more: 8 series will have ~40% at least 2 series get the same color
  // Opposed to the previous implementation, we cycled between 8 series, so every panel with 8+ series was guaranteed to have 1 duplicate, but the color of each series would change depending on the sort order
  // Also the first 8 colors in the palette are visually dissimilar, but some of the full set of 56 are pretty hard to differentiate visually
  // If the color is out of bounds (i.e. 57) we get a gray color, which looks different enough from the others
  let paletteIndex = hash % paletteSize;
  // const initialPaletteIndex = paletteIndex

  // function grabNextBucket(index: number) {
  //     // console.log('grabNextBucket', {index, size: paletteSet.size})
  //     if (paletteSet.has(index)) {
  //         return true
  //     } else {
  //         paletteSet.add(index)
  //         return false
  //     }
  // }
  //
  // while(grabNextBucket(paletteIndex) && paletteSet.size < paletteSize){
  //     paletteIndex = paletteIndex + 1 % paletteSize
  // }
  // if(paletteSet.size === paletteSize){
  //     // console.log('clear palette index set')
  //     paletteSet.clear()
  // }

  return visTheme.getColorByName(visTheme.palette[paletteIndex]);
}

function getHash(input: string) {
  let hash = 0,
    len = input.length;
  for (let i = 0; i < len; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // to 32bit integer
  }
  return hash;
}

export function setFixedColorByDisplayNameTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        if (data?.[0]?.refId === LOGS_PANEL_QUERY_REFID) {
          return data;
        }
        const paletteSet = new Set<number>();
        return data.map((frame, frameIndex) => {
          return {
            ...frame,
            fields: frame.fields.map((f, fieldIndex) => {
              // Time fields do not have color config
              if (f.type === FieldType.time) {
                return f;
              }
              const displayName = getFieldDisplayName(f, frame, data);
              return {
                ...f,
                config: {
                  ...f.config,
                  color: {
                    fixedColor: getColorByName(displayName, paletteSet),
                    mode: 'fixed',
                  },
                },
              };
            }),
          };
        });
      })
    );
  };
}

export function sortLevelTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data
          .map((d) => {
            if (d.fields.length < 2) {
              return d;
            }
            if (!d.fields[1].config.displayNameFromDS) {
              d.fields[1].config.displayNameFromDS = UNKNOWN_LEVEL_LOGS;
            }
            return d;
          })
          .sort((a, b) => {
            if (a.fields.length < 2 || b.fields.length < 2) {
              return 0;
            }
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

  return new SceneDataTransformer({
    $data: getSceneQueryRunner({
      datasource: { uid: WRAPPED_LOKI_DS_UID },
      queries: queries,
      ...queryRunnerOptions,
    }),
    transformations: [setFixedColorByDisplayNameTransformation],
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
