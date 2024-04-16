import React, { PropsWithChildren, useRef } from 'react';
import { css } from '@emotion/css';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { ClickOutsideWrapper, Icon, Popover, useTheme2 } from '@grafana/ui';

import { useTableHeaderContext } from '@/components/Context/TableHeaderContext';
import { DATAPLANE_BODY_NAME } from '@/services/logsFrame';

export interface LogsTableHeaderProps extends PropsWithChildren<CustomHeaderRendererProps> {
  fieldIndex: number;
  // setShowPopover: (show: boolean) => void
  // showPopover: boolean
  // onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}
//@todo delete in g11
export interface CustomHeaderRendererProps {
  field: Field;
  defaultContent: React.ReactNode;
}

const getStyles = (theme: GrafanaTheme2, isFirstColumn: boolean, isLine: boolean) => ({
  tableHeaderMenu: css({
    label: 'tableHeaderMenu',
    width: '100%',
    minWidth: '250px',
    height: '100%',
    maxHeight: '400px',
    backgroundColor: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    padding: theme.spacing(2),
    margin: theme.spacing(1, 0),
    boxShadow: theme.shadows.z3,
    borderRadius: theme.shape.radius.default,
  }),
  button: css({
    appearance: 'none',
    right: '5px',
    background: 'none',
    border: 'none',
    padding: 0,
  }),
  wrapper: css({
    display: 'flex',
    marginLeft: isFirstColumn ? '56px' : '6px',
    // Body has extra padding then other columns
    width: isLine ? 'calc(100% + 6px)' : '100%',

    // Hack to show a visible resize indicator, despite 6px of padding on the header in grafana/table
    borderRight: `1px solid ${theme.colors.border.weak}`,
    marginRight: '-6px',
  }),
  defaultContentWrapper: css({
    borderLeft: isFirstColumn ? `1px solid ${theme.colors.border.weak}` : 'none',
    marginLeft: isFirstColumn ? '-6px' : 0,
    paddingLeft: isFirstColumn ? '12px' : 0,
    display: 'flex',
  }),
});

export const LogsTableHeader = (props: LogsTableHeaderProps) => {
  const { setHeaderMenuActive, isHeaderMenuActive } = useTableHeaderContext();
  const referenceElement = useRef<HTMLButtonElement | null>(null);
  const theme = useTheme2();
  const styles = getStyles(theme, props.fieldIndex === 0, props.field.name === DATAPLANE_BODY_NAME);

  return (
    <span className={styles.wrapper}>
      <span className={styles.defaultContentWrapper}>{props.defaultContent}</span>
      <button
        className={styles.button}
        ref={referenceElement}
        onClick={(e) => {
          setHeaderMenuActive(!isHeaderMenuActive);
        }}
      >
        <Icon title={'Show menu'} name={'ellipsis-v'} />
      </button>
      {referenceElement.current && (
        <Popover
          show={isHeaderMenuActive}
          content={
            <ClickOutsideWrapper onClick={() => setHeaderMenuActive(false)} useCapture={true}>
              <div className={styles.tableHeaderMenu}>{props.children}</div>
            </ClickOutsideWrapper>
          }
          referenceElement={referenceElement.current}
        />
      )}
    </span>
  );
};
