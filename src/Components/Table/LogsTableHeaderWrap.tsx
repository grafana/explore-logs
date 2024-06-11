import { LogsTableHeader, LogsTableHeaderProps } from 'Components/Table/LogsTableHeader';
import { FieldNameMetaStore } from 'Components/Table/TableTypes';
import { useTableHeaderContext } from 'Components/Table/Context/TableHeaderContext';
import { LogLineState, useTableColumnContext } from 'Components/Table/Context/TableColumnsContext';
import { Icon } from '@grafana/ui';
import React, { useCallback } from 'react';
import { Field } from '@grafana/data';
import { getBodyName } from '../../services/logsFrame';
import { css, cx } from '@emotion/css';
import { useQueryContext } from './Context/QueryContext';

export function LogsTableHeaderWrap(props: {
  headerProps: LogsTableHeaderProps;
  openColumnManagementDrawer: () => void;

  // Moves the current column forward or backward one index
  slideLeft?: (cols: FieldNameMetaStore) => void;
  slideRight?: (cols: FieldNameMetaStore) => void;
}) {
  const { setHeaderMenuActive } = useTableHeaderContext();
  const { columns, setColumns, bodyState, setBodyState } = useTableColumnContext();
  const { logsFrame } = useQueryContext();
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

  const isBodyField = props.headerProps.field.name === getBodyName(logsFrame);

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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 17 16"
            width="17"
            height="16"
            className="css-q2u0ig-Icon"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M1.73446 1.33301H12.2345C12.3892 1.33301 12.5375 1.40325 12.6469 1.52827C12.7563 1.65329 12.8178 1.82286 12.8178 1.99967V4.74967C12.8178 5.07184 12.5566 5.33301 12.2345 5.33301C11.9123 5.33301 11.6511 5.07184 11.6511 4.74967V2.66634H7.56779V13.333H11.6511V10.9163C11.6511 10.5942 11.9123 10.333 12.2345 10.333C12.5566 10.333 12.8178 10.5942 12.8178 10.9163V13.9997C12.8178 14.1765 12.7563 14.3461 12.6469 14.4711C12.5375 14.5961 12.3892 14.6663 12.2345 14.6663H1.73446C1.57975 14.6663 1.43137 14.5961 1.32198 14.4711C1.21258 14.3461 1.15112 14.1765 1.15112 13.9997V1.99967C1.15112 1.82286 1.21258 1.65329 1.32198 1.52827C1.43137 1.40325 1.57975 1.33301 1.73446 1.33301ZM2.31779 13.333H6.40112V2.66634H2.31779V13.333Z"
              fill="#CCCCDC"
              fillOpacity="1"
            />
            <path
              d="M15.9893 10.6315C15.9498 10.7263 15.8919 10.8123 15.819 10.8846C15.7467 10.9575 15.6607 11.0154 15.5659 11.0549C15.4712 11.0943 15.3695 11.1147 15.2668 11.1147C15.1641 11.1147 15.0625 11.0943 14.9677 11.0549C14.8729 11.0154 14.7869 10.9575 14.7146 10.8846L12.9335 9.09573L11.1524 10.8846C11.0801 10.9575 10.9941 11.0154 10.8993 11.0549C10.8045 11.0943 10.7028 11.1147 10.6002 11.1147C10.4975 11.1147 10.3958 11.0943 10.301 11.0549C10.2063 11.0154 10.1202 10.9575 10.0479 10.8846C9.97504 10.8123 9.91717 10.7263 9.87769 10.6315C9.8382 10.5367 9.81787 10.4351 9.81787 10.3324C9.81787 10.2297 9.8382 10.1281 9.87769 10.0333C9.91717 9.9385 9.97504 9.85248 10.0479 9.78017L11.8368 7.99906L10.0479 6.21795C9.90148 6.07149 9.8192 5.87285 9.8192 5.66573C9.8192 5.4586 9.90148 5.25996 10.0479 5.1135C10.1944 4.96705 10.393 4.88477 10.6002 4.88477C10.8073 4.88477 11.0059 4.96705 11.1524 5.1135L12.9335 6.90239L14.7146 5.1135C14.8611 4.96705 15.0597 4.88477 15.2668 4.88477C15.4739 4.88477 15.6726 4.96705 15.819 5.1135C15.9655 5.25996 16.0478 5.4586 16.0478 5.66573C16.0478 5.87285 15.9655 6.07149 15.819 6.21795L14.0302 7.99906L15.819 9.78017C15.8919 9.85248 15.9498 9.9385 15.9893 10.0333C16.0288 10.1281 16.0491 10.2297 16.0491 10.3324C16.0491 10.4351 16.0288 10.5367 15.9893 10.6315Z"
              fill="#CCCCDC"
              fillOpacity="1"
            />
          </svg>
          Remove column
        </a>
      </div>
      {props.slideLeft && (
        <div className={styles.linkWrap}>
          <a className={styles.link} onClick={() => props.slideLeft?.(columns)}>
            <Icon className={cx(styles.icon, styles.reverse)} name={'arrow-from-right'} size={'md'} />
            Move left
          </a>
        </div>
      )}
      {props.slideRight && (
        <div className={styles.linkWrap}>
          <a className={styles.link} onClick={() => props.slideRight?.(columns)}>
            <Icon className={styles.icon} name={'arrow-from-right'} size={'md'} />
            Move right
          </a>
        </div>
      )}
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
