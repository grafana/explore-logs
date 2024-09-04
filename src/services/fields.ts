import { DataFrame, Field, ReducerID } from '@grafana/data';
import { DrawStyle, StackingMode } from '@grafana/ui';
import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneCSSGridItem,
  SceneDataTransformer,
  SceneObject,
} from '@grafana/scenes';
import { getColorByIndex } from './scenes';
import { AddToFiltersButton, VariableFilterType } from 'Components/ServiceScene/Breakdowns/AddToFiltersButton';
import {
  getLogsStreamSelector,
  getValueFromFieldsFilter,
  LOG_STREAM_SELECTOR_EXPR,
  LogsQueryOptions,
  ParserType,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
} from './variables';
import { setLevelColorOverrides } from './panel';
import { map, Observable } from 'rxjs';
import { SortBy, SortByScene } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { getDetectedFieldsFrame } from '../Components/ServiceScene/ServiceScene';
import { averageFields } from '../Components/ServiceScene/Breakdowns/FieldsBreakdownScene';

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

const getReducerId = (sortBy: SortBy) => {
  if (sortBy) {
    const values: string[] = Object.values(ReducerID);
    if (values.includes(sortBy)) {
      return sortBy;
    }
  }
  return undefined;
};

/**
 * Extracts the ExtractedFieldsType from the string returned on the detected_fields api parser field value
 * @param parserString
 */
export function extractParserFromString(parserString: string): ParserType {
  switch (parserString) {
    case 'json':
      return 'json';
    case 'logfmt':
      return 'logfmt';
    case '': // Structured metadata is empty
      return 'structuredMetadata';
    default: // if we get a parser with multiple
      return 'mixed';
  }
}

export function extractParserFromArray(parsers?: string[]): ParserType {
  const parsersSet = new Set(parsers?.map((v) => v.toString()) ?? []);

  // Structured metadata doesn't change the parser we use, so remove it
  parsersSet.delete('');

  // get unique values
  const parsersArray = Array.from(parsersSet);

  if (parsersArray.length === 1) {
    return extractParserFromString(parsersArray[0]);
  }

  // If the set size is zero, we only had structured metadata detected as a parser
  if (parsersSet.size === 0) {
    return 'structuredMetadata';
  }

  // Otherwise if there was more then one value, return mixed parser
  return 'mixed';
}

export function extractParserFromDetectedFields(data: DataFrame): ParserType {
  const parserField = data.fields.find((f) => f.name === 'parser');
  const values: string[] | undefined = parserField?.values;

  return extractParserFromArray(values);
}

export function getParserForField(fieldName: string, sceneRef: SceneObject): ParserType | undefined {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];

  const index = namesField?.values.indexOf(fieldName);
  const parser =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index] ?? '') : undefined;

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

export function getFilterTypeFromLabelType(type: LabelType | null, key: string, value: string): VariableFilterType {
  switch (type) {
    case LabelType.Indexed: {
      return VAR_LABELS;
    }
    case LabelType.Parsed: {
      return VAR_FIELDS;
    }
    case LabelType.StructuredMetadata: {
      return VAR_LEVELS;
    }
    default: {
      console.error(`Invalid label for ${key}`, value);
      throw new Error(`Invalid label type for ${key}`);
    }
  }
}

export function getParserFromFieldsFilters(fields: AdHocFiltersVariable): ParserType {
  const parsers = fields.state.filters.map((filter) => {
    return getValueFromFieldsFilter(filter).parser;
  });

  return extractParserFromArray(parsers);
}

export function isAvgField(field: string) {
  return averageFields.includes(field);
}

export function getFieldBreakdownExpr(field: string) {
  if (isAvgField(field)) {
    return (
      `avg_over_time(${LOG_STREAM_SELECTOR_EXPR} | unwrap ` +
      (field === 'duration' ? `duration` : field === 'bytes' ? `bytes` : ``) +
      `(${field}) [$__auto]) by ()`
    );
  }
  return `sum by (${field}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | ${field}!="" [$__auto]))`;
}

export function buildFieldsQuery(optionValue: string, options: LogsQueryOptions) {
  if (isAvgField(optionValue)) {
    return (
      `avg_over_time(${getLogsStreamSelector(options)} | unwrap ` +
      (optionValue === 'duration' ? `duration` : optionValue === 'bytes' ? `bytes` : ``) +
      `(${optionValue}) [$__auto]) by ()`
    );
  } else {
    return `sum by (${optionValue}) (count_over_time(${getLogsStreamSelector(options)} [$__auto]))`;
  }
}

export function buildFieldsQueryString(
  optionValue: string,
  fieldsVariable: AdHocFiltersVariable,
  detectedFieldsFrame?: DataFrame
) {
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];
  const index = namesField?.values.indexOf(optionValue);

  const parserForThisField =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index] ?? 'mixed') : undefined;

  const parsers = fieldsVariable.state.filters.map((filter) => {
    const index = namesField?.values.indexOf(filter.key);
    const parser =
      index !== undefined && index !== -1
        ? extractParserFromString(parserField?.values?.[index] ?? 'mixed')
        : undefined;

    return parser ?? 'mixed';
  });

  const parser = extractParserFromArray([...parsers, parserForThisField ?? '']);

  let fieldExpressionToAdd = '';
  let structuredMetadataToAdd = '';

  if (parserForThisField === 'structuredMetadata') {
    structuredMetadataToAdd = `| ${optionValue}!=""`;
    // Structured metadata
  } else {
    fieldExpressionToAdd = `| ${optionValue}!=""`;
  }

  // is option structured metadata
  const options: LogsQueryOptions = {
    structuredMetadataToAdd,
    fieldExpressionToAdd,
    parser: parser,
  };
  return buildFieldsQuery(optionValue, options);
}
