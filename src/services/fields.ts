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
  DetectedFieldType,
  LEVEL_VARIABLE_VALUE,
  LogsQueryOptions,
  ParserType,
  VAR_FIELDS,
  VAR_LABELS,
  VAR_LEVELS,
  VAR_METADATA,
} from './variables';
import { setLevelColorOverrides } from './panel';
import { map, Observable } from 'rxjs';
import { SortBy, SortByScene } from '../Components/ServiceScene/Breakdowns/SortByScene';
import { getDetectedFieldsFrame } from '../Components/ServiceScene/ServiceScene';
import { getLogsStreamSelector, getValueFromFieldsFilter } from './variableGetters';
import { LabelType } from './fieldsTypes';
import { logger } from './logger';
import { PanelMenu } from '../Components/Panels/PanelMenu';

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
  parsers: string[] | null;
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
export function extractParserFromString(parserString?: string): ParserType {
  switch (parserString) {
    case 'json':
      return 'json';
    case 'logfmt':
      return 'logfmt';
    case '': // Structured metadata is empty
      return 'structuredMetadata';
    case 'structuredMetadata': // Structured metadata is empty
      return 'structuredMetadata';
    default: // if we get a parser with multiple
      return 'mixed';
  }
}

export function extractFieldTypeFromString(fieldString?: string): DetectedFieldType {
  switch (fieldString) {
    case 'int':
    case 'float':
    case 'duration':
    case 'boolean':
    case 'bytes':
      return fieldString;
    default:
      return 'string';
  }
}

export function extractParserFromArray(parsers?: string[]): ParserType {
  const parsersSet = new Set(parsers?.map((v) => v.toString()) ?? []);

  // Structured metadata doesn't change the parser we use, so remove it
  parsersSet.delete('structuredMetadata');

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

export function getParserForField(fieldName: string, sceneRef: SceneObject): ParserType | undefined {
  const detectedFieldsFrame = getDetectedFieldsFrame(sceneRef);
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];

  const index = namesField?.values.indexOf(fieldName);
  const parser =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index] ?? '') : undefined;

  if (parser === undefined) {
    logger.warn('missing parser, using mixed format for', { fieldName });
    return 'mixed';
  }
  return parser;
}

export function getFilterBreakdownValueScene(
  getTitle: (df: DataFrame) => string,
  style: DrawStyle,
  variableName: typeof VAR_FIELDS | typeof VAR_LABELS | typeof VAR_METADATA,
  sortByScene: SortByScene,
  labelKey?: string
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
      .setMenu(new PanelMenu({ frame, fieldName: getTitle(frame), labelName: labelKey }))
      .setHeaderActions([new AddToFiltersButton({ frame, variableName })]);

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

/**
 * Returns the variable to use when adding filters in a panel.
 * @param frame
 * @param key
 * @param sceneRef
 */
export function getVariableForLabel(
  frame: DataFrame | undefined,
  key: string,
  sceneRef: SceneObject
): VariableFilterType {
  const labelType = frame ? getLabelTypeFromFrame(key, frame) : LabelType.Parsed;

  if (labelType) {
    // Use the labelType from the dataframe
    return getFilterTypeFromLabelType(labelType, key, sceneRef);
  }

  // If the dataframe doesn't have labelTypes, check if the detected_fields response returned a parser.
  const parserForThisField = getParserForField(key, sceneRef);
  if (parserForThisField === 'structuredMetadata') {
    return VAR_METADATA;
  }

  logger.warn('unable to determine label variable, falling back to parsed field', {
    key,
    parserForThisField: parserForThisField ?? '',
  });

  return VAR_FIELDS;
}

export function getFilterTypeFromLabelType(type: LabelType, key: string, sceneRef: SceneObject): VariableFilterType {
  switch (type) {
    case LabelType.Indexed: {
      return VAR_LABELS;
    }
    case LabelType.Parsed: {
      return VAR_FIELDS;
    }
    case LabelType.StructuredMetadata: {
      // Structured metadata is either a special level variable, or a field variable
      if (key === LEVEL_VARIABLE_VALUE) {
        return VAR_LEVELS;
      }
      return VAR_METADATA;
    }
    default: {
      const err = new Error(`Invalid label type for ${key}`);
      logger.error(err, { type, msg: `Invalid label type for ${key}` });
      throw err;
    }
  }
}

export function getParserFromFieldsFilters(fields: AdHocFiltersVariable): ParserType {
  const parsers = fields.state.filters.map((filter) => {
    return getValueFromFieldsFilter(filter).parser;
  });

  return extractParserFromArray(parsers);
}

export function isAvgField(fieldType: DetectedFieldType | undefined) {
  return fieldType === 'duration' || fieldType === 'bytes' || fieldType === 'float';
}

export function buildFieldsQuery(optionValue: string, options: LogsQueryOptions) {
  if (options.fieldType && ['bytes', 'duration'].includes(options.fieldType)) {
    return (
      `avg_over_time(${getLogsStreamSelector(options)} | unwrap ` +
      options.fieldType +
      `(${optionValue}) | __error__="" [$__auto]) by ()`
    );
  } else if (options.fieldType && options.fieldType === 'float') {
    return (
      `avg_over_time(${getLogsStreamSelector(options)} | unwrap ` + optionValue + ` | __error__="" [$__auto]) by ()`
    );
  } else {
    return `sum by (${optionValue}) (count_over_time(${getLogsStreamSelector(options)} [$__auto]))`;
  }
}

/**
 * Returns the DetectedFieldType if available for a specific label
 * @param optionValue
 * @param detectedFieldsFrame
 */
export function getDetectedFieldType(optionValue: string, detectedFieldsFrame?: DataFrame) {
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];
  const typesField: Field<string> | undefined = detectedFieldsFrame?.fields[3];
  const index = namesField?.values.indexOf(optionValue);
  return index !== undefined && index !== -1 ? extractFieldTypeFromString(typesField?.values?.[index]) : undefined;
}

export function buildFieldsQueryString(
  optionValue: string,
  fieldsVariable: AdHocFiltersVariable,
  detectedFieldsFrame?: DataFrame
) {
  const parserField: Field<string> | undefined = detectedFieldsFrame?.fields[2];
  const namesField: Field<string> | undefined = detectedFieldsFrame?.fields[0];
  const typesField: Field<string> | undefined = detectedFieldsFrame?.fields[3];
  const index = namesField?.values.indexOf(optionValue);

  const parserForThisField =
    index !== undefined && index !== -1 ? extractParserFromString(parserField?.values?.[index]) : 'mixed';

  const optionType =
    index !== undefined && index !== -1 ? extractFieldTypeFromString(typesField?.values?.[index]) : undefined;

  // Get the parser from the json payload of each filter
  const parsers = fieldsVariable.state.filters.map((filter) => {
    const index = namesField?.values.indexOf(filter.key);
    const parserFromFilterValue = getValueFromFieldsFilter(filter);
    if (parserFromFilterValue.parser) {
      return parserFromFilterValue.parser;
    }

    // Then fallback to check the latest response
    const parser =
      index !== undefined && index !== -1
        ? extractParserFromString(parserField?.values?.[index] ?? 'mixed')
        : undefined;
    return parser ?? 'mixed';
  });

  const parser = extractParserFromArray([...parsers, parserForThisField]);

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
    fieldType: optionType,
  };

  return buildFieldsQuery(optionValue, options);
}

// copied from /grafana/grafana/public/app/plugins/datasource/loki/datasource.ts:1204
export function lokiRegularEscape<T>(value: T) {
  if (typeof value === 'string') {
    return value.replace(/'/g, "\\\\'");
  }
  return value;
}
