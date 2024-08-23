import {DataFrame, ReducerID} from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import {PanelBuilders, SceneCSSGridItem, SceneDataTransformer, sceneGraph, SceneObject} from '@grafana/scenes';
import { getColorByIndex } from './scenes';
import { AddToFiltersButton } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import { getLogsFormatVariable, VAR_FIELDS, VAR_LABELS } from './variables';
import { setLevelColorOverrides } from './panel';
import { map, Observable } from 'rxjs';
import {SortByScene} from "../Components/ServiceScene/Breakdowns/SortByScene";

export type DetectedLabel = {
  label: string;
  cardinality: number;
};

export type DetectedLabelsResponse = {
  detectedLabels: DetectedLabel[];
};

interface ExtractedFields {
  type: 'logfmt' | 'json';
  fields: string[];
}

export function updateParserFromDataFrame(frame: DataFrame, sceneRef: SceneObject): ExtractedFields {
  const variable = getLogsFormatVariable(sceneRef);
  const res = extractParserAndFieldsFromDataFrame(frame);

  let newType;
  if (!res.type) {
    newType = '';
  } else if (res.type === 'json') {
    newType = `| json  | logfmt | drop __error__, __error_details__`;
  } else {
    newType = ` | ${res.type}`;
  }

  if (variable.getValue() !== newType) {
    variable.changeValueTo(newType);
  }

  return res;
}

export function extractParserAndFieldsFromDataFrame(data: DataFrame) {
  const result: ExtractedFields = { type: 'logfmt', fields: [] };
  const labelTypesField = data.fields.find((f) => f.name === 'labelTypes');
  result.fields = Object.keys(
    labelTypesField?.values.reduce((acc: Record<string, boolean>, value: Record<string, string>) => {
      Object.entries(value)
        .filter(([_, v]) => v === 'P')
        .forEach(([k]) => (acc[k] = true));
      return acc;
    }, {}) ?? {}
  );

  const linesField = data.fields.find((f) => f.name === 'Line' || f.name === 'body');
  result.type = linesField?.values[0]?.[0] === '{' ? 'json' : 'logfmt';

  return result;
}

export function getFilterBreakdownValueScene(
  getTitle: (df: DataFrame) => string,
  style: DrawStyle,
  variableName: typeof VAR_FIELDS | typeof VAR_LABELS,
  sort: SortByScene
) {
  console.log('sort', sort)
  let reducerID: ReducerID;
  if(sort.state.sortBy){
    // Is there a way to avoid the type assertion?
    const values: string[] = Object.values(ReducerID);
    if(values.includes(sort.state.sortBy)){
      reducerID = sort.state.sortBy as ReducerID
    }
  }

  return (frame: DataFrame, frameIndex: number) => {
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

    if(reducerID){
      panel.setOption('legend', {
        showLegend: true,
        calcs: [reducerID]
      })
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
