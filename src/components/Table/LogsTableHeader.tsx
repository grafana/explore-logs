import React, { PropsWithChildren, useRef } from 'react';
import { css } from '@emotion/css';

import { Field, GrafanaTheme2 } from '@grafana/data';
import { ClickOutsideWrapper, Icon, Popover, useTheme2 } from '@grafana/ui';

import { useTableHeaderContext } from '@/components/Context/TableHeaderContext';

//@ts-ignore defined in g11
export interface LogsTableHeaderProps extends PropsWithChildren<CustomHeaderRendererProps> {
  myProp: string;
  field: Field;
  defaultContent: React.ReactNode;
  // setShowPopover: (show: boolean) => void
  // showPopover: boolean
  // onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

const getStyles = (theme: GrafanaTheme2) => ({
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
});

export const LogsTableHeader = (props: LogsTableHeaderProps) => {
  const { setHeaderMenuActive, isHeaderMenuActive } = useTableHeaderContext();
  const referenceElement = useRef<HTMLButtonElement | null>(null);
  const theme = useTheme2();
  const styles = getStyles(theme);

  return (
    <span style={{ display: 'flex' }}>
      {props.defaultContent}
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
