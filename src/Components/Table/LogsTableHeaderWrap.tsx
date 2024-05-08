import { LogsTableHeader, LogsTableHeaderProps } from 'Components/Table/LogsTableHeader';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { useTableHeaderContext } from 'Components/Table/Context/TableHeaderContext';
import { LogLineState, useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { Icon } from '@grafana/ui';
import React, { useCallback } from 'react';
import { Field } from '@grafana/data';
import { DATAPLANE_BODY_NAME } from '../../services/logsFrame';
import { css, cx } from '@emotion/css';

export function LogsTableHeaderWrap(props: {
  headerProps: LogsTableHeaderProps;
  openColumnManagementDrawer: () => void;

  // Moves the current column forward or backward one index
  slideLeft: (cols: FieldNameMetaStore) => void;
  slideRight: (cols: FieldNameMetaStore) => void;
}) {
  const { setHeaderMenuActive } = useTableHeaderContext();
  const { columns, setColumns, bodyState, setBodyState } = useTableColumnContext();
  const styles = getStyles();

  const hideColumn = useCallback(
    (field: Field) => {
      const pendingColumnState = { ...columns };

      const columnsThatNeedIndexUpdate = Object.keys(pendingColumnState)
        .filter((col) => {
          const columnIndex = pendingColumnState[col].index;
          const fieldIndex = pendingColumnState[field.name].index;
          return pendingColumnState[col].active && fieldIndex && columnIndex && columnIndex > fieldIndex;
        })
        .map((cols) => pendingColumnState[cols]);

      columnsThatNeedIndexUpdate.forEach((col) => {
        if (col.index !== undefined) {
          col.index--;
        }
      });

      pendingColumnState[field.name].active = false;
      pendingColumnState[field.name].index = undefined;
      setColumns(pendingColumnState);
    },
    [columns, setColumns]
  );

  const isBodyField = props.headerProps.field.name === DATAPLANE_BODY_NAME;

  return (
    <LogsTableHeader {...props.headerProps}>
      <div className={styles.linkWrap}>
        <a
          className={styles.link}
          onClick={() => {
            props.openColumnManagementDrawer();
            setHeaderMenuActive(false);
          }}
        >
          <Icon className={styles.icon} name={'columns'} size={'md'} />
          Manage columns
        </a>
      </div>
      <div className={styles.linkWrap}>
        <a className={styles.link} onClick={() => hideColumn(props.headerProps.field)}>
          <Icon className={styles.icon} name={'minus'} size={'md'} />
          Remove column
        </a>
      </div>
      <div className={styles.linkWrap}>
        <a className={styles.link} onClick={() => props.slideRight(columns)}>
          <Icon className={cx(styles.icon, styles.reverse)} name={'arrow-from-right'} size={'md'} />
          Move left
        </a>
      </div>
      <div className={styles.linkWrap}>
        <a className={styles.link} onClick={() => props.slideLeft(columns)}>
          <Icon className={styles.icon} name={'arrow-from-right'} size={'md'} />
          Move right
        </a>
      </div>
      {isBodyField && (
        <div className={styles.linkWrap}>
          <a
            className={styles.link}
            onClick={() => {
              if (bodyState === LogLineState.text) {
                setBodyState(LogLineState.labels);
              } else {
                setBodyState(LogLineState.text);
              }
            }}
          >
            {bodyState === LogLineState.text ? (
              <Icon className={styles.icon} name={'brackets-curly'} size={'md'} />
            ) : (
              <Icon className={styles.icon} name={'text-fields'} size={'md'} />
            )}

            {bodyState === LogLineState.text ? 'Show labels' : 'Show log text'}
          </a>
        </div>
      )}
    </LogsTableHeader>
  );
}

const getStyles = () => {
  return {
    reverse: css({
      transform: 'scaleX(-1)',
    }),
    link: css({
      paddingTop: '5px',
      paddingBottom: '5px',
    }),
    icon: css({
      marginRight: '10px',
    }),
    linkWrap: css({}),
  };
};
