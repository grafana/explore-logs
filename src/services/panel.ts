import { DataFrame } from '@grafana/data';
import { SceneDataTransformer, SceneQueryRunner } from '@grafana/scenes';
import { map, Observable } from 'rxjs';
import { LokiQuery } from './query';
import { explorationDS } from './variables';

// TODO: `FieldConfigOverridesBuilder` is not exported, so it can not be used here.
export function levelOverrides(overrides: any) {
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
}

export function sortLevelTransformation() {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((data: DataFrame[]) => {
        return data.sort((a, b) => {
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

export function getQueryRunner(query: LokiQuery) {
  // if there's formatting related to `level`, we want to sort the output equally
  if (query.legendFormat?.toLowerCase().includes('level')) {
    return new SceneDataTransformer({
      $data: new SceneQueryRunner({
        datasource: explorationDS,
        queries: [query],
      }),
      transformations: [sortLevelTransformation],
    });
  }

  return new SceneQueryRunner({
    datasource: explorationDS,
    queries: [query],
  });
}
