import React from 'react';
import { css } from '@emotion/css';

import { GrafanaTheme2, LinkModel } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';
import { useQueryContext } from './Context/QueryContext';

interface Props {
  fieldType?: 'derived';
  label: string;
  value: string;
  showColumn?: () => void;
  links?: LinkModel[];
  pillType: 'logPill' | 'column';
}

const getStyles = (theme: GrafanaTheme2, pillType: 'logPill' | 'column') => ({
  menu: css({
    position: 'relative',
    paddingRight: '5px',
    display: 'flex',
    minWidth: '60px',
    justifyContent: 'flex-start',
  }),
  menuItemsWrap: css({
    boxShadow: theme.shadows.z3,
    display: 'flex',
    background: theme.colors.background.secondary,
    padding: '5px 0',
    marginLeft: pillType === 'column' ? '5px' : undefined,
  }),
  menuItem: css({
    overflow: 'auto',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    paddingLeft: '5px',
    paddingRight: '5px',
  }),
});

export enum FilterOp {
  Equal = '=',
  NotEqual = '!=',
}

export const CellContextMenu = (props: Props) => {
  const theme = useTheme2();
  const styles = getStyles(theme, props.pillType);
  const { addFilter } = useQueryContext();

  return (
    <span className={styles.menu}>
      <span className={styles.menuItemsWrap}>
        {props.fieldType !== 'derived' && (
          <>
            <div
              className={styles.menuItem}
              onClick={() => {
                addFilter({
                  key: props.label,
                  value: props.value,
                  operator: FilterOp.Equal,
                });
              }}
            >
              <Icon title={'Add to search'} size={'md'} name={'plus-circle'} />
            </div>
            <div
              className={styles.menuItem}
              onClick={() => {
                addFilter({
                  key: props.label,
                  value: props.value,
                  operator: FilterOp.NotEqual,
                });
              }}
            >
              <Icon title={'Exclude from search'} size={'md'} name={'minus-circle'} />
            </div>
          </>
        )}

        {props.showColumn && (
          <div onClick={props.showColumn} className={styles.menuItem}>
            <Icon title={'Add column'} size={'md'} name={'columns'} />
          </div>
        )}

        {props.links &&
          props.links.map((link) => {
            return (
              <div
                className={styles.menuItem}
                onClick={() => {
                  //@todo hacky openy
                  window.open(link.href, '_blank');
                }}
                key={link.href}
              >
                <Icon title={link.title ?? 'Link'} key={link.href} size={'md'} name={'link'} />
                {/*@todo this comes from user defined data in loki config, needs some limits */}
              </div>
            );
          })}
      </span>
    </span>
  );
};
