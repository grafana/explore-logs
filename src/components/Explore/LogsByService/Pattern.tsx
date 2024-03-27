import { css } from '@emotion/css';
import { Button, Icon, Tag, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import React from 'react';

interface Props {
  type: 'include' | 'exclude';
  onRemove(): void;
  pattern: string;
}

export const Pattern = ({ type, onRemove, pattern }: Props) => {
  const styles = useStyles2(getStyles);
  return (<div className={styles.pattern}>
    <Tag
      key={pattern}
      name={pattern}
      className={styles.tag}
    />
    <Button variant='secondary' size='sm' className={styles.removeButton} onClick={onRemove}>
      <Icon name="times" />
    </Button>
  </div>)
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    pattern: css({
      display: 'flex',
      fontFamily: 'monospace',
      gap: theme.spacing(0.25),
    }),
    tag: css({
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor: theme.colors.secondary.main,
      border: `solid 1px ${theme.colors.secondary.border}`,
      color: theme.colors.secondary.text,
      boxSizing: 'border-box',
      padding: theme.spacing(0.25, 0.75)
    }),
    removeButton: css({
      paddingLeft: 2.5,
      paddingRight: 2.5,
    })
  }
}
