import React, { useCallback, useLayoutEffect, useState } from 'react';
import { css } from '@emotion/css';

import {
  DataFrame,
  FieldType,
  FieldWithIndex,
  getTimeZone,
  GrafanaTheme2,
  guessFieldTypeFromValue,
  Labels,
} from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { TableColumnContextProvider } from '@/components/Context/TableColumnsContext';
import { Table } from '@/components/Table/Table';
import { FieldNameMeta, FieldNameMetaStore } from '@/components/Table/TableTypes';
import { useQueryContext } from '@/components/Context/QueryContext';

export type LogFrameLabels = Record<string, unknown>;

export type SpecialFieldsType = {
  time: FieldWithIndex;
  body: FieldWithIndex;
  extraFields: FieldWithIndex[];
};

// matches common ISO 8601
const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,})?(?:Z|[-+]\d{2}:?\d{2})$/;

interface TableWrapProps {}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    position: 'relative',
  }),
});

export const TableWrap = (props: TableWrapProps) => {
  const { logsFrame } = useQueryContext();
  const [width, height] = useWindowSize();

  const theme = useTheme2();
  const styles = getStyles(theme);

  const timeZone = getTimeZone();

  // This function is called when we want to grab the column names that are currently stored in the URL.
  // If we rely on the state being passed in from scenes we have to force a re-render of the entire table, which reverts any state not stored in scenes (modals, menus, column widths, etc)
  // So instead we have to grab the current columns directly from the URL. This could lead to bugs,
  const getColumnsFromProps = useCallback((fieldNames: FieldNameMetaStore) => {
    const searchParams = new URLSearchParams(location.search);
    const tableColumnsRaw = searchParams.get('tableColumns');
    const tableColumnsFromUrl: string[] = tableColumnsRaw ? JSON.parse(tableColumnsRaw) : [];
    const previouslySelected = tableColumnsFromUrl;
    if (previouslySelected?.length) {
      Object.values(previouslySelected).forEach((key, index) => {
        if (fieldNames[key]) {
          fieldNames[key].active = true;
          fieldNames[key].index = index;
        }
      });
    }

    return fieldNames;
  }, []);

  // If the data frame is empty, there's nothing to viz, it could mean the user has unselected all columns
  if (!logsFrame || !logsFrame.raw.length) {
    return null;
  }

  const labels = logsFrame.getLogFrameLabelsAsLabels() ?? [];
  const numberOfLogLines = logsFrame ? logsFrame.raw.length : 0;

  // If we have labels and log lines
  let pendingLabelState = mapLabelsToInitialState(logsFrame.raw, labels);
  const specialFields = {
    time: logsFrame.timeField,
    body: logsFrame.bodyField,
    extraFields: logsFrame.extraFields,
  };

  // Normalize the other fields
  if (specialFields) {
    addSpecialLabelsState(
      [specialFields.time, specialFields.body, ...specialFields.extraFields],
      pendingLabelState,
      numberOfLogLines
    );

    pendingLabelState = getColumnsFromProps(pendingLabelState);

    // Get all active columns
    const active = Object.keys(pendingLabelState).filter((key) => pendingLabelState[key].active);

    // If nothing is selected, then select the default columns
    setSpecialFieldMeta(active, specialFields, pendingLabelState);
  }

  return (
    <section className={styles.section}>
      <TableColumnContextProvider logsFrame={logsFrame} initialColumns={pendingLabelState}>
        <Table logsFrame={logsFrame} timeZone={timeZone} height={height - 220} width={width - 50} labels={labels} />
      </TableColumnContextProvider>
    </section>
  );
};

const normalize = (value: number, total: number): number => {
  return Math.ceil((100 * value) / total);
};

type labelName = string;
type labelValue = string;

export function getCardinalityMapFromLabels(labels: Labels[]) {
  const cardinalityMap = new Map<labelName, { valueSet: Set<labelValue>; maxLength: number }>();
  labels.forEach((fieldLabels) => {
    const labelNames = Object.keys(fieldLabels);
    labelNames.forEach((labelName) => {
      if (cardinalityMap.has(labelName)) {
        const setObj = cardinalityMap.get(labelName);
        const values = setObj?.valueSet;
        const maxLength = setObj?.maxLength;

        if (values && !values?.has(fieldLabels[labelName])) {
          values?.add(fieldLabels[labelName]);
          if (maxLength && fieldLabels[labelName].length > maxLength) {
            cardinalityMap.set(labelName, { maxLength: fieldLabels[labelName].length, valueSet: values });
          }
        }
      } else {
        cardinalityMap.set(labelName, {
          maxLength: fieldLabels[labelName].length,
          valueSet: new Set([fieldLabels[labelName]]),
        });
      }
    });
  });

  return cardinalityMap;
}

// Hacky resize-y
//@todo discuss with squad
function useWindowSize() {
  const [size, setSize] = useState([0, 0]);
  useLayoutEffect(() => {
    function updateSize() {
      setSize([window.innerWidth, window.innerHeight]);
    }

    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  return size;
}

/**
 * Guess the field type of the value
 * @param value
 */
export function guessLogsFieldTypeForValue(value: string) {
  let fieldType = guessFieldTypeFromValue(value);
  const isISO8601 = fieldType === 'string' && iso8601Regex.test(value);
  if (isISO8601) {
    fieldType = FieldType.time;
  }
  return fieldType;
}

function mapLabelsToInitialState(dataFrame: DataFrame, labels: Labels[]) {
  let pendingLabelState: FieldNameMetaStore = {};

  // Use a map to dedupe labels and count their occurrences in the logs
  const labelMap = new Map<string, FieldNameMeta>();
  const cardinality = getCardinalityMapFromLabels(labels);
  const numberOfLogLines = dataFrame ? dataFrame.length : 0;

  if (labels?.length && numberOfLogLines) {
    // Iterate through all of Labels
    labels.forEach((labels: Labels) => {
      const labelsArray = Object.keys(labels);
      // Iterate through the label values
      labelsArray.forEach((label) => {
        const cardinalityMap = cardinality.get(label);
        const cardinalityCount = cardinalityMap?.valueSet?.size ?? 0;
        // If it's already in our map, increment the count
        if (labelMap.has(label)) {
          const value = labelMap.get(label);

          if (value) {
            if (value?.active) {
              labelMap.set(label, {
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                active: true,
                index: value.index,
                cardinality: cardinalityCount,
                maxLength: cardinalityMap?.maxLength,
              });
            } else {
              labelMap.set(label, {
                percentOfLinesWithLabel: value.percentOfLinesWithLabel + 1,
                active: false,
                index: undefined,
                cardinality: cardinalityCount,
                maxLength: cardinalityMap?.maxLength,
              });
            }
          }
          // Otherwise add it
        } else {
          labelMap.set(label, {
            percentOfLinesWithLabel: 1,
            active: false,
            index: undefined,
            cardinality: cardinalityCount,
            maxLength: cardinalityMap?.maxLength,
          });
        }
      });
    });

    // Converting the map to an object
    pendingLabelState = Object.fromEntries(labelMap);

    // Convert count to percent of log lines
    Object.keys(pendingLabelState).forEach((key) => {
      pendingLabelState[key].percentOfLinesWithLabel = normalize(
        pendingLabelState[key].percentOfLinesWithLabel,
        numberOfLogLines
      );
    });
  }
  return pendingLabelState;
}

/**
 * Add special fields like time and body
 * @param specialFieldArray
 * @param pendingLabelState
 * @param numberOfLogLines
 */
function addSpecialLabelsState(
  specialFieldArray: Array<FieldWithIndex | undefined>,
  pendingLabelState: FieldNameMetaStore,
  numberOfLogLines: number
) {
  specialFieldArray.forEach((field) => {
    if (!field) {
      return;
    }
    const isActive = pendingLabelState[field.name]?.active;
    const index = pendingLabelState[field.name]?.index;
    if (isActive && index !== undefined) {
      pendingLabelState[field.name] = {
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
        active: true,
        index: index,
        cardinality: numberOfLogLines,
      };
    } else {
      pendingLabelState[field.name] = {
        percentOfLinesWithLabel: normalize(
          field.values.filter((value) => value !== null && value !== undefined).length,
          numberOfLogLines
        ),
        active: false,
        index: undefined,
        cardinality: numberOfLogLines,
      };
    }
  });

  return pendingLabelState;
}

function setSpecialFieldMeta(
  active: string[],
  specialFields: SpecialFieldsType,
  pendingLabelState: FieldNameMetaStore
) {
  // If no fields are visible, set defaults
  if (active.length === 0) {
    if (specialFields.body?.name) {
      pendingLabelState[specialFields.body?.name].active = true;
      pendingLabelState[specialFields.body?.name].index = 1;
    }
    if (specialFields.time?.name) {
      pendingLabelState[specialFields.time?.name].active = true;
      pendingLabelState[specialFields.time?.name].index = 0;
    }
  }

  if (specialFields.time?.name && specialFields.body?.name) {
    pendingLabelState[specialFields.body?.name].type = 'BODY_FIELD';
    pendingLabelState[specialFields.time?.name].type = 'TIME_FIELD';
  }

  if (specialFields.extraFields.length) {
    specialFields.extraFields.forEach((field) => {
      const hasLinks = field.config.links?.length;
      if (hasLinks) {
        pendingLabelState[field.name].type = 'LINK_FIELD';
      }
    });
  }
}
