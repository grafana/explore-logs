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
    display: 'flex',
    alignItems: 'center',
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
            {/* commented out until filters have added support for negative filters*/}
            {/*<div*/}
            {/*  className={styles.menuItem}*/}
            {/*  onClick={() => {*/}
            {/*    addFilter({*/}
            {/*      key: props.label,*/}
            {/*      value: props.value,*/}
            {/*      operator: FilterOp.NotEqual,*/}
            {/*    });*/}
            {/*  }}*/}
            {/*>*/}
            {/*  <Icon title={'Exclude from search'} size={'md'} name={'minus-circle'} />*/}
            {/*</div>*/}
          </>
        )}

        {props.showColumn && (
          <div onClick={props.showColumn} className={styles.menuItem}>
            <svg width="18" height="16" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M1.38725 1.33301H13.3872C13.5641 1.33301 13.7336 1.40325 13.8587 1.52827C13.9837 1.65329 14.0539 1.82286 14.0539 1.99967V2.33333C14.0539 2.70152 13.7554 3 13.3872 3H13.0542C12.87 3 12.7206 2.85062 12.7206 2.66634H8.05391V13.333H12.7206C12.7206 13.1491 12.8697 13 13.0536 13H13.3872C13.7554 13 14.0539 13.2985 14.0539 13.6667V13.9997C14.0539 14.1765 13.9837 14.3461 13.8587 14.4711C13.7336 14.5961 13.5641 14.6663 13.3872 14.6663H1.38725C1.21044 14.6663 1.04087 14.5961 0.915843 14.4711C0.790819 14.3461 0.720581 14.1765 0.720581 13.9997V1.99967C0.720581 1.82286 0.790819 1.65329 0.915843 1.52827C1.04087 1.40325 1.21044 1.33301 1.38725 1.33301ZM2.05391 13.333H6.72058V2.66634H2.05391V13.333Z"
                fill="#CCCCDC"
                fillOpacity="1"
              />
              <path
                d="M13.8538 7.19999H16.2538C16.466 7.19999 16.6695 7.28429 16.8195 7.4343C16.9696 7.58432 17.0538 7.78783 17.0538 7.99999C17.0538 8.21214 16.9696 8.41566 16.8195 8.56567C16.6695 8.71569 16.466 8.79999 16.2538 8.79999H13.8538V11.2C13.8538 11.4121 13.7696 11.6156 13.6195 11.7657C13.4695 11.9157 13.266 12 13.0538 12C12.8416 12 12.6382 11.9157 12.4881 11.7657C12.3381 11.6156 12.2538 11.4121 12.2538 11.2V8.79999H9.85384C9.64165 8.79999 9.43819 8.71569 9.28815 8.56567C9.13811 8.41566 9.05383 8.21214 9.05383 7.99999C9.05383 7.78783 9.13811 7.58432 9.28815 7.4343C9.43819 7.28429 9.64165 7.19999 9.85384 7.19999H12.2538V4.8C12.2538 4.58784 12.3381 4.38433 12.4881 4.23431C12.6382 4.0843 12.8416 4 13.0538 4C13.266 4 13.4695 4.0843 13.6195 4.23431C13.7696 4.38433 13.8538 4.58784 13.8538 4.8V7.19999Z"
                fill="#CCCCDC"
                fillOpacity="1"
              />
            </svg>
          </div>
        )}

        {props.links &&
          props.links.map((link) => {
            return (
              <div
                className={styles.menuItem}
                onClick={() => {
                  window.open(link.href, '_blank');
                }}
                key={link.href}
              >
                <Icon title={link.title ?? 'Link'} key={link.href} size={'md'} name={'link'} />
              </div>
            );
          })}
      </span>
    </span>
  );
};
