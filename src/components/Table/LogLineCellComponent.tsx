import React, { useRef, useState } from 'react';
import { ScrollSyncPane } from 'react-scroll-sync';
import { css } from '@emotion/css';

import { FieldType, formattedValueToString, GrafanaTheme2, Labels } from '@grafana/data';
import { ClipboardButton, CustomCellRendererProps, Icon, IconButton, Modal, useTheme2 } from '@grafana/ui';

import { useQueryContext } from '@/components/Context/QueryContext';
import { useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { getBgColorForCell } from '@/components/Table/DefaultCellComponent';
import { DefaultCellWrapComponent } from '@/components/Table/DefaultCellWrapComponent';
import { LogLinePill } from '@/components/Table/LogLinePill';
import { UrlParameterType } from '@/services/routing';
import { useScenesTableContext } from '@/components/Context/ScenesTableContext';

export type SelectedTableRow = {
  row: number;
  id: string;
};

const getStyles = (theme: GrafanaTheme2, bgColor?: string) => ({
  clipboardButton: css({
    padding: 0,
    height: '100%',
    lineHeight: '1',
    width: '20px',
  }),
  content: css`
    margin-left: 7px;
    white-space: nowrap;
    overflow-x: auto;
    -ms-overflow-style: none; /* IE and Edge */
    scrollbar-width: none; /* Firefox */
    padding-right: 30px;
    display: flex;
    align-items: flex-start;

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
      background: linear-gradient(
        to right,
        transparent calc(100% - 10px),
        ${bgColor ?? theme.colors.background.primary}
      );
    }
  `,
  inspectButton: css({
    display: 'inline-flex',
    verticalAlign: 'middle',
    margin: 0,
    overflow: 'hidden',
    borderRadius: '5px',
  }),
  inspect: css({
    padding: '5px 3px',

    '&:hover': {
      color: theme.colors.text.link,
      cursor: 'pointer',
    },
  }),
  scroller: css`
    position: absolute;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 20px;
    top: 32px;
    margin-top: -24px;
    // For some reason clicking on this button causes text to be selected in the following row
    user-select: none;
  `,
  scrollLeft: css`
    cursor: pointer;
    background: ${theme.colors.background.primary};

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
  scrollRight: css`
    cursor: pointer;
    background: ${theme.colors.background.primary};

    &:hover {
      background: ${theme.colors.background.secondary};
    }
  `,
});

interface Props extends CustomCellRendererProps {
  labels: Labels;
}

const stopScroll = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    left: id.current?.scrollLeft,
  });
};

const goLeft = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    top: 0,
    left: 0,
    behavior: 'smooth',
  });
};

const goRight = (id: React.MutableRefObject<HTMLDivElement | null>) => {
  id?.current?.scrollTo({
    top: 0,
    left: id.current.scrollWidth,
    behavior: 'smooth',
  });
};

export const LogLineCellComponent = (props: Props) => {
  let value = props.value;
  const field = props.field;
  const displayValue = field.display!(value);
  const theme = useTheme2();
  const bgColor = getBgColorForCell(props);
  const styles = getStyles(theme, bgColor);
  const { setColumns, columns, setVisible } = useTableColumnContext();
  const { logsFrame } = useQueryContext();
  const [isInspecting, setIsInspecting] = useState(false);
  const { timeRange } = useScenesTableContext();
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
   * What if we never even rendered the log line as written, and always re-created it using labels.
   * Assuming we're always parsing our log line with logfmt, this should work? And give the UI more control in visualization and interaction?
   * @param labels
   * @param onClick
   */
  const renderLabels = (labels: Labels, onClick: (label: string) => void) => {
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

    // Don't render pills for columns that are already viz?
    return labelNames
      .filter(
        (label) =>
          // Not already visible in another column
          !columns[label].active &&
          // And the cardinality is greater than 1
          columns[label].cardinality > 1
      )
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
      });
  };

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
          <div className={styles.inspect}>
            <IconButton
              className={styles.inspectButton}
              tooltip="View log line"
              variant="secondary"
              aria-label="View log line"
              tooltipPlacement="top"
              size="md"
              name="eye"
              onClick={() => setIsInspecting(true)}
              tabIndex={0}
            />
          </div>
          <div className={styles.inspect}>
            <ClipboardButton
              className={styles.clipboardButton}
              icon="share-alt"
              variant="secondary"
              fill="text"
              size="md"
              tooltip="Copy link to logline"
              tooltipPlacement="top"
              tabIndex={0}
              getText={() => {
                // Does this force absolute?
                const searchParams = new URLSearchParams(window.location.search);
                if (searchParams) {
                  const selectedLine: SelectedTableRow = {
                    row: props.rowIndex,
                    id: logsFrame?.idField?.values[props.rowIndex],
                  };

                  // Stringifying the time range wraps in quotes, which breaks url
                  searchParams.set(UrlParameterType.From, JSON.stringify(timeRange?.from).slice(1, -1));
                  searchParams.set(UrlParameterType.To, JSON.stringify(timeRange?.to).slice(1, -1));
                  searchParams.set(UrlParameterType.SelectedLine, JSON.stringify(selectedLine));

                  return window.location.origin + window.location.pathname + '?' + searchParams.toString();
                }
                return '';
              }}
            />
          </div>
          {/* @todo component*/}
          <>{renderLabels(props.labels, onClick)}</>

          {isHover && (
            <div className={styles.scroller}>
              <span onPointerDown={() => goLeft(ref)} onPointerUp={() => stopScroll(ref)} className={styles.scrollLeft}>
                <Icon name={'arrow-left'} />
              </span>
              <span
                onPointerDown={() => goRight(ref)}
                onPointerUp={() => stopScroll(ref)}
                className={styles.scrollRight}
              >
                <Icon name={'arrow-right'} />
              </span>
            </div>
          )}
        </div>
      </ScrollSyncPane>
      {isInspecting && (
        <Modal onDismiss={() => setIsInspecting(false)} isOpen={true} title="Inspect value">
          <pre>{value as string}</pre>
          <Modal.ButtonRow>
            <ClipboardButton icon="copy" getText={() => value as string}>
              Copy to Clipboard
            </ClipboardButton>
          </Modal.ButtonRow>
        </Modal>
      )}
    </DefaultCellWrapComponent>
  );
};
