import { DataFrame, ReducerID } from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { PanelBuilders, SceneCSSGridItem, SceneDataTransformer, SceneObject } from '@grafana/scenes';
import { getColorByIndex } from './scenes';
import { AddToFiltersButton } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getLogsFormatVariable, VAR_FIELDS, VAR_LABELS } from './variables';
import { setLevelColorOverrides } from './panel';
import { map, Observable } from 'rxjs';
import { SortBy, SortByScene } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { memoize } from 'lodash';

export type DetectedLabel = {
  label: string;
  cardinality: number;
};

export type DetectedLabelsResponse = {
  detectedLabels: DetectedLabel[];
};

export type DetectedField = {
  label: string;
  cardinality: number;
  type: string;
  parsers: string[];
};

export type DetectedFieldsResponse = {
  fields: DetectedField[];
};
type ExtractedFieldsType = 'logfmt' | 'json' | 'mixed' | '';

export function updateParserFromDataFrame(frame: DataFrame, sceneRef: SceneObject) {
  const variable = getLogsFormatVariable(sceneRef);
  const type = extractParserFromDetectedFields(frame);

  let newType;
  if (!type) {
    newType = '';
  } else if (type === 'mixed') {
    newType = `| json  | logfmt | drop __error__, __error_details__`;
  } else {
    newType = ` | ${type}`;
  }

  if (variable.getValue() !== newType) {
    variable.changeValueTo(newType);
  }
}

export function extractParserFromDetectedFields(data: DataFrame): ExtractedFieldsType {
  const parserField = data.fields.find((f) => f.name === 'parser');

  const parsersSet = new Set(parserField?.values.map((v) => v.toString()) ?? []);

  // Structured metadata doesn't change the parser we use, so remove it
  parsersSet.delete('');

  // get unique values
  const parsersArray = Array.from(parsersSet);

  if (parsersArray.length === 1) {
    switch (parsersArray[0]) {
      case 'json':
        return 'json';
      case 'logfmt':
        return 'logfmt';
      case '': // Structured metadata is empty
        return '';
      // if we get a parser with multiple
      default:
        return 'mixed';
    }
  }

  if (parsersSet.size > 1) {
    return 'mixed';
  }

  return '';
}

const getReducerId = memoize((sortBy: SortBy) => {
  let reducerID: ReducerID | undefined = undefined;
  if (sortBy) {
    // Is there a way to avoid the type assertion?
    const values: string[] = Object.values(ReducerID);
    if (values.includes(sortBy)) {
      reducerID = sortBy as ReducerID;
    }
  }
  return reducerID;
});

export function getFilterBreakdownValueScene(
  getTitle: (df: DataFrame) => string,
  style: DrawStyle,
  variableName: typeof VAR_FIELDS | typeof VAR_LABELS,
  sortByScene: SortByScene
) {
  return (frame: DataFrame, frameIndex: number) => {
    const reducerID = getReducerId(sortByScene.state.sortBy);
    const panel = PanelBuilders.timeseries() //
      .setOption('legend', { showLegend: false })
      .setCustomFieldConfig('fillOpacity', 9)
      .setTitle(getTitle(frame))
      .setData(
        new SceneDataTransformer({
          transformations: [() => selectFrameTransformation(frame)],
        })
      )
      .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
      .setOverrides(setLevelColorOverrides)
      .setHeaderActions(new AddToFiltersButton({ frame, variableName }));

    if (style === DrawStyle.Bars) {
      panel
        .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
        .setCustomFieldConfig('fillOpacity', 100)
        .setCustomFieldConfig('lineWidth', 0)
        .setCustomFieldConfig('pointSize', 0)
        .setOverrides(setLevelColorOverrides)
        .setCustomFieldConfig('drawStyle', DrawStyle.Bars);
    }

    if (reducerID) {
      panel.setOption('legend', {
        showLegend: true,
        calcs: [reducerID],
      });
      // These will only have a single series, no need to show the title twice
      panel.setDisplayName(' ');
    }

    return new SceneCSSGridItem({
      body: panel.build(),
    });
  };
}

export function selectFrameTransformation(frame: DataFrame) {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map(() => {
        return [frame];
      })
    );
  };
}

// copied from public/app/plugins/datasource/loki/types.ts
export enum LabelType {
  Indexed = 'I',
  StructuredMetadata = 'S',
  Parsed = 'P',
}

export function getLabelTypeFromFrame(labelKey: string, frame: DataFrame, index = 0): null | LabelType {
  const typeField = frame.fields.find((field) => field.name === 'labelTypes')?.values[index];
  if (!typeField) {
    return null;
  }
  switch (typeField[labelKey]) {
    case 'I':
      return LabelType.Indexed;
    case 'S':
      return LabelType.StructuredMetadata;
    case 'P':
      return LabelType.Parsed;
    default:
      return null;
  }
}
