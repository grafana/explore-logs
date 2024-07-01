import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  logsStatsRow: css({
    margin: `${theme.spacing(1.15)}px 0`,
  }),
  logsStatsRowActive: css({
    color: theme.colors.primary.text,
    position: 'relative',
  }),
  logsStatsRowLabel: css({
    display: 'flex',
    marginBottom: '1px',
  }),
  logsStatsRowValue: css({
    flex: 1,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  logsStatsRowCount: css({
    textAlign: 'right',
    marginLeft: theme.spacing(0.75),
  }),
  logsStatsRowPercent: css({
    textAlign: 'right',
    marginLeft: theme.spacing(0.75),
    width: theme.spacing(4.5),
  }),
  logsStatsRowBar: css({
    height: theme.spacing(0.5),
    overflow: 'hidden',
    background: theme.colors.text.disabled,
  }),
  logsStatsRowInnerBar: css({
    height: theme.spacing(0.5),
    overflow: 'hidden',
    background: theme.colors.primary.main,
  }),
});

export interface Props {
  active?: boolean;
  count: number;
  proportion: number;
  value?: string;
}

export const PatternFieldLabelStatsRow = ({ active, count, proportion, value }: Props) => {
  const style = useStyles2(getStyles);
  const percent = `${Math.round(proportion * 100)}%`;
  const barStyle = { width: percent };

  return (
    <div className={active ? `${style.logsStatsRow} ${style.logsStatsRowActive}` : style.logsStatsRow}>
      <div className={style.logsStatsRowLabel}>
        <div className={style.logsStatsRowValue} title={value}>
          {value}
        </div>
        <div className={style.logsStatsRowCount}>{count}</div>
        <div className={style.logsStatsRowPercent}>{percent}</div>
      </div>
      <div className={style.logsStatsRowBar}>
        <div className={style.logsStatsRowInnerBar} style={barStyle} />
      </div>
    </div>
  );
};

PatternFieldLabelStatsRow.displayName = 'LogLabelStatsRow';
