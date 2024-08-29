import { DataFrame, Field, ReducerID } from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { PanelBuilders, SceneCSSGridItem, SceneDataTransformer, SceneObject } from '@grafana/scenes';
import { getColorByIndex } from './scenes';
import { AddToFiltersButton } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { VAR_FIELDS, VAR_LABELS } from './variables';
import { setLevelColorOverrides } from './panel';
import { map, Observable } from 'rxjs';
import { SortBy, SortByScene } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { memoize } from 'lodash';
import { getDetectedFieldsFrame } from '../Components/ServiceScene/ServiceScene';

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

type ExtractedFieldsType = 'logfmt' | 'json' | 'mixed' | '';

export function extractParserFromDetectedFieldParserFieldValue(parserString: string): ExtractedFieldsType {
  switch (parserString) {
    case 'json':
      return 'json';
    case 'logfmt':
      return 'logfmt';
    case '': // Structured metadata is empty
      return '';
    default: // if we get a parser with multiple
      return 'mixed';
  }
}

export function extractParserFieldFromParserArray(parsers?: string[]) {
  const parsersSet = new Set(parsers?.map((v) => v.toString()) ?? []);

  // Structured metadata doesn't change the parser we use, so remove it
  parsersSet.delete('');

  // get unique values
  const parsersArray = Array.from(parsersSet);

  if (parsersArray.length === 1) {
    return extractParserFromDetectedFieldParserFieldValue(parsersArray[0]);
  }

  if (parsersSet.size > 1) {
    return 'mixed';
  }

  return '';
}

export function extractParserFromDetectedFields(data: DataFrame): ExtractedFieldsType {
  const parserField = data.fields.find((f) => f.name === 'parser');
  const values: string[] | undefined = parserField?.values;

  return extractParserFieldFromParserArray(values);
}

export function getParserForField(fieldName: string, sceneRef: SceneObject): ExtractedFieldsType | undefined {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];

  const index = namesField?.values.indexOf(fieldName);
  const parser =
    index && index !== -1
      ? extractParserFromDetectedFieldParserFieldValue(parserField?.values?.[index] ?? '')
      : undefined;

  if (parser === undefined) {
    console.warn('missing parser, using mixed format for', fieldName);
    return 'mixed';
  }
  return parser;
}

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
  if (!frame) {
    console.warn('missing frame?');
  }
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
