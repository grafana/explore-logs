import React, { useRef, useState } from 'react';
import { ScrollSyncPane } from 'react-scroll-sync';

import { FieldType, formattedValueToString, GrafanaTheme2, Labels } from '@grafana/data';
import { CustomCellRendererProps, useTheme2 } from '@grafana/ui';

import { useQueryContext } from 'Components/Table/Context/QueryContext';
import { LogLineState, useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { DefaultCellWrapComponent } from 'Components/Table/DefaultCellWrapComponent';
import { LogLinePill } from 'Components/Table/LogLinePill';
import { Scroller } from 'Components/Table/Scroller';
import { css } from '@emotion/css';
import { LineActionIcons } from 'Components/Table/LineActionIcons';
import { RawLogLineText } from 'Components/Table/RawLogLineText';
import { getBodyName } from '../../services/logsFrame';
import { LEVEL_NAME } from './Constants';

export type SelectedTableRow = {
  row: number;
  id: string;
};

interface Props extends CustomCellRendererProps {
  labels: Labels;
  fieldIndex: number;
}
export const LogLineCellComponent = (props: Props) => {
  let value = props.value;
  const field = props.field;
  const displayValue = field.display!(value);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const { columns, setVisible, bodyState } = useTableColumnContext();
  const { logsFrame } = useQueryContext();
  const [isHover, setIsHover] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  if (React.isValidElement(props.value)) {
    value = props.value;
  } else if (typeof value === 'object') {
    value = JSON.stringify(props.value);
  } else {
    value = formattedValueToString(displayValue);
  }

  /**
   * Render labels as log line pills
   * @param labels Label[]
   */
  const renderLabels = (labels: Labels) => {
    const columnLabelNames = Object.keys(columns);
    const labelNames = columnLabelNames
      .filter((name) => name !== getBodyName(logsFrame))
      .sort((a, b) => {
        // Sort level first
        if (a === LEVEL_NAME) {
          return -1;
        }
        if (b === LEVEL_NAME) {
          return 1;
        }
        // Then sort links
        if (columns[a].type === 'LINK_FIELD') {
          return -1;
        }
        if (columns[b].type === 'LINK_FIELD') {
          return 1;
        }

        // Finally sort fields by cardinality descending
        return columns[a].cardinality > columns[b].cardinality ? -1 : 1;
      });

    const filteredLabels = labelNames.filter(
      (label) =>
        // Not already visible in another column
        !columns[label].active &&
        // And the cardinality is greater than 1
        columns[label].cardinality > 1
    );

    return filteredLabels
      .map((label) => {
        const labelValue = labels[label];
        const untransformedField = logsFrame?.raw?.fields.find((field) => field.name === label);
        const rawValue = field?.values[props.rowIndex];
        const isDerived = !labelValue && !!rawValue;

        // If we have a label value, the field is not derived
        if (labelValue) {
          return (
            <LogLinePill
              originalFrame={undefined}
              field={field}
              columns={columns}
              rowIndex={props.rowIndex}
              frame={props.frame}
              showColumns={() => setVisible(true)}
              key={label}
              label={label}
              isDerivedField={false}
              value={labelValue}
            />
          );
        }

        // Otherwise, the field might be derived
        if (isDerived && untransformedField?.name) {
          const untransformedValue = untransformedField?.values[props.rowIndex];
          if (untransformedField?.type === FieldType.string && untransformedValue) {
            return (
              <LogLinePill
                originalFrame={logsFrame?.raw}
                originalField={untransformedField}
                field={field}
                value={untransformedValue}
                columns={columns}
                rowIndex={props.rowIndex}
                frame={props.frame}
                showColumns={() => setVisible(true)}
                key={untransformedField.name}
                label={untransformedField.name}
                isDerivedField={true}
              />
            );
          }
        }

        return null;
      })
      .filter((v) => v);
  };

  const labels = renderLabels(props.labels);
  const isAuto = bodyState === LogLineState.auto;
  const hasLabels = labels.length > 0;

  return (
    <DefaultCellWrapComponent
      onMouseIn={() => {
        setIsHover(true);
      }}
      onMouseOut={() => {
        setIsHover(false);
      }}
      rowIndex={props.rowIndex}
      field={props.field}
    >
      <ScrollSyncPane innerRef={ref} group="horizontal">
        <div className={styles.content}>
          {/* First Field gets the icons */}
          {props.fieldIndex === 0 && <LineActionIcons rowIndex={props.rowIndex} value={value} />}
          {/* Labels */}
          {isAuto && hasLabels && <>{labels}</>}
          {bodyState === LogLineState.labels && hasLabels && <>{labels}</>}
          {bodyState === LogLineState.labels && !hasLabels && <RawLogLineText value={value} />}

          {/* Raw log line*/}
          {isAuto && !hasLabels && <RawLogLineText value={value} />}
          {bodyState === LogLineState.text && <RawLogLineText value={value} />}

          {isHover && <Scroller scrollerRef={ref} />}
        </div>
      </ScrollSyncPane>
    </DefaultCellWrapComponent>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  content: css`
    white-space: nowrap;
    overflow-x: auto;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    padding-right: 30px;
    display: flex;
    align-items: flex-start;
    height: 100%;
    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari and Opera */
    }

    &:after {
      pointer-events: none;
      content: '';
      width: 100%;
      height: 100%;
      position: absolute;
      left: 0;
      top: 0;
      // Fade out text in last 10px to background color to add affordance to horiziontal scroll
      background: linear-gradient(to right, transparent calc(100% - 10px), ${theme.colors.background.primary});
    }
  `,
});
