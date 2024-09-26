import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, useTheme2 } from '@grafana/ui';

import { FieldNameMeta } from '../TableTypes';

function getStyles(theme: GrafanaTheme2) {
  return {
    dragIcon: css({
      cursor: 'drag',
      marginLeft: theme.spacing(1),
      opacity: 0.4,
    }),
    labelCount: css({
      marginLeft: theme.spacing(0.5),
      marginRight: theme.spacing(0.5),
      appearance: 'none',
      background: 'none',
      border: 'none',
      fontSize: theme.typography.pxToRem(11),
      opacity: 0.6,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'self-end',
    }),
    contentWrap: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }),
    customWidthWrap: css({
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
    }),
    // Hide text that overflows, had to select elements within the Checkbox component, so this is a bit fragile
    checkboxLabel: css({
      '> span': {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        maxWidth: '100%',
      },
    }),
  };
}

export function LogsTableNavField(props: {
  label: string;
  onChange: () => void;
  labels: Record<string, FieldNameMeta>;
  draggable?: boolean;
  showCount?: boolean;
  setColumnWidthMap?: (map: Record<string, number>) => void;
  columnWidthMap?: Record<string, number>;
}): React.JSX.Element | null {
  const theme = useTheme2();
  const styles = getStyles(theme);

  if (props.labels[props.label]) {
    return (
      <>
        <div className={styles.contentWrap}>
          <Checkbox
            className={styles.checkboxLabel}
            label={props.label}
            onChange={props.onChange}
            checked={props.labels[props.label]?.active ?? false}
          />
          {props.showCount && (
            <div className={styles.labelCount}>
              <div>{props.labels[props.label]?.percentOfLinesWithLabel}%</div>
              <div>
                {props.labels[props.label]?.cardinality}{' '}
                {props.labels[props.label]?.cardinality === 1 ? 'value' : 'values'}
              </div>
            </div>
          )}
          {props.columnWidthMap && props.setColumnWidthMap && props.columnWidthMap?.[props.label] !== undefined && (
            <div
              onClick={() => {
                const { [props.label]: omit, ...map } = { ...props.columnWidthMap };
                props.setColumnWidthMap?.(map);
              }}
              title={'Clear column width override'}
              className={styles.customWidthWrap}
            >
              Width: {props.columnWidthMap?.[props.label]}
              <Icon name={'x'} />
            </div>
          )}
        </div>
        {props.draggable && (
          <Icon
            aria-label="Drag and drop icon"
            title="Drag and drop to reorder"
            name="draggabledots"
            size="lg"
            className={styles.dragIcon}
          />
        )}
      </>
    );
  }

  return null;
}
