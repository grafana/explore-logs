import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';

import { FieldNameMeta } from '../TableTypes';

import { LogsTableEmptyFields } from './LogsTableEmptyFields';
import { LogsTableNavField } from './LogsTableNavField';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function getLogsFieldsStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      marginTop: theme.spacing(0.25),
      marginBottom: theme.spacing(0.25),
      display: 'flex',
      background: theme.colors.background.primary,
      borderBottom: `1px solid ${theme.colors.background.canvas}`,
    }),
    dragging: css({
      background: theme.colors.background.secondary,
    }),
    columnWrapper: css({
      marginBottom: theme.spacing(1.5),
      // need some space or the outline of the checkbox is cut off
      paddingLeft: theme.spacing(0.5),
    }),
  };
}

function sortLabels(labels: Record<string, FieldNameMeta>) {
  return (a: string, b: string) => {
    const la = labels[a];
    const lb = labels[b];

    // ...sort by type and alphabetically
    if (la != null && lb != null) {
      return (
        Number(lb.type === 'TIME_FIELD') - Number(la.type === 'TIME_FIELD') ||
        Number(lb.type === 'BODY_FIELD') - Number(la.type === 'BODY_FIELD') ||
        collator.compare(a, b)
      );
    }

    // otherwise do not sort
    return 0;
  };
}

export const LogsTableAvailableFields = (props: {
  labels: Record<string, FieldNameMeta>;
  valueFilter: (value: string) => boolean;
  toggleColumn: (columnName: string) => void;
}): JSX.Element => {
  const { labels, valueFilter, toggleColumn } = props;
  const theme = useTheme2();
  const styles = getLogsFieldsStyles(theme);
  const labelKeys = Object.keys(labels).filter((labelName) => valueFilter(labelName));
  if (labelKeys.length) {
    // Otherwise show list with a hardcoded order
    return (
      <div className={styles.columnWrapper}>
        {labelKeys.sort(sortLabels(labels)).map((labelName, index) => (
          <div
            key={labelName}
            className={styles.wrap}
            title={`${labelName} appears in ${labels[labelName]?.percentOfLinesWithLabel}% of log lines`}
          >
            <LogsTableNavField
              showCount={true}
              label={labelName}
              onChange={() => toggleColumn(labelName)}
              labels={labels}
            />
          </div>
        ))}
      </div>
    );
  }

  return <LogsTableEmptyFields />;
};
