import { css } from '@emotion/css';
import { Button, Icon, Tag } from '@grafana/ui';
import React from 'react';

interface Props {
  type: 'include' | 'exclude';
  onRemove(): void;
  pattern: string;
}

export const Pattern = ({ type, onRemove, pattern }: Props) => {
  return (<div className={styles.pattern}>
    <Tag
      key={pattern}
      name={pattern}
      colorIndex={type === 'include' ? 6 : 8}
      className={styles.tag}
    />
    <Button variant='secondary' size='sm' className={styles.removeButton} onClick={onRemove}>
      <Icon name="times" />
    </Button>
  </div>)
}

const styles = {
  pattern: css({
    display: 'flex',
  }),
  tag: css({
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  }),
  removeButton: css({
    paddingLeft: 2.5,
    paddingRight: 2.5,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  })
}
