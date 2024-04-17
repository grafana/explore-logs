import React, { useRef, useState } from 'react';
import { ScrollSyncPane } from 'react-scroll-sync';

import { FieldType, formattedValueToString, GrafanaTheme2, Labels } from '@grafana/data';
import { CustomCellRendererProps, useTheme2 } from '@grafana/ui';

import { useQueryContext } from '@/components/Context/QueryContext';
import { LogLineState, useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { getBgColorForCell } from '@/components/Table/DefaultCellComponent';
import { DefaultCellWrapComponent } from '@/components/Table/DefaultCellWrapComponent';
import { LogLinePill } from '@/components/Table/LogLinePill';
import { Scroller } from '@/components/Table/Scroller';
import { css } from '@emotion/css';
import { LineActionIcons } from '@/components/Table/LineActionIcons';

export type SelectedTableRow = {
  row: number;
  id: string;
};

interface Props extends CustomCellRendererProps {
  labels: Labels;
  fieldIndex: number;
}

function RawLogLineText(props: { styles: { rawLogLine: string; content: string }; value: unknown }) {
  return (
    <div className={props.styles.rawLogLine}>
      <>{props.value}</>
    </div>
  );
}
export const LogLineCellComponent = (props: Props) => {
  let value = props.value;
  const field = props.field;
  const displayValue = field.display!(value);
  const theme = useTheme2();
  const bgColor = getBgColorForCell(props);
  const styles = getStyles(theme, bgColor);
  const { setColumns, columns, setVisible, bodyState } = useTableColumnContext();
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

  const onClick = (label: string) => {
    const pendingColumns = { ...columns };

    const length = Object.keys(columns).filter((c) => columns[c].active).length;
    if (pendingColumns[label].active) {
      pendingColumns[label].active = false;
      pendingColumns[label].index = undefined;
    } else {
      pendingColumns[label].active = true;
      pendingColumns[label].index = length;
    }

    setColumns(pendingColumns);
  };

  /**
   * Render labels as log line pills
   * @param labels Label[]
   * @param onClick
   * @param value raw log line
   */
  const renderLabels = (labels: Labels, onClick: (label: string) => void, value: unknown) => {
    const columnLabelNames = Object.keys(columns);
    const labelNames = columnLabelNames.sort((a, b) => {
      // Sort level first
      if (a === 'level') {
        return -1;
      }
      if (b === 'level') {
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
              showColumn={onClick}
            />
          );
        }
        if (isDerived && untransformedField?.name) {
          const untransformedValue = untransformedField?.values[props.rowIndex];
          // are derived fields always strings?
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
                showColumn={onClick}
              />
            );
          }
        }

        return null;
      })
      .filter((v) => v);
  };

  const labels = renderLabels(props.labels, onClick, props.value);
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
          {bodyState === LogLineState.labels && !hasLabels && <div className={styles.rawLogLine}>No unique labels</div>}

          {/* Raw log line*/}
          {isAuto && !hasLabels && <RawLogLineText styles={styles} value={value} />}
          {bodyState === LogLineState.text && <RawLogLineText styles={styles} value={value} />}

          {isHover && <Scroller scrollerRef={ref} />}
        </div>
      </ScrollSyncPane>
    </DefaultCellWrapComponent>
  );
};

export const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  rawLogLine: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    height: '35px',
    lineHeight: '35px',
    paddingRight: theme.spacing(1.5),
    paddingLeft: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
  }),
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
      background: linear-gradient(
        to right,
        transparent calc(100% - 10px),
        ${bgColor ?? theme.colors.background.primary}
      );
    }
  `,
});
