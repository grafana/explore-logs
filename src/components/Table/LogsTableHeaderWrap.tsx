import { LogsTableHeader, LogsTableHeaderProps } from '@/components/Table/LogsTableHeader';
import { FieldNameMetaStore } from '@/components/Table/TableTypes';
import { useTableHeaderContext } from '@/components/Context/TableHeaderContext';
import { useTableColumnContext } from '@/components/Context/TableColumnsContext';
import { Icon } from '@grafana/ui';
import React, { useCallback } from 'react';
import { Field } from '@grafana/data';

export function LogsTableHeaderWrap(props: {
  headerProps: LogsTableHeaderProps;
  // removeColumn: () => void;
  openColumnManagementDrawer: () => void;

  // Moves the current column forward or backward one index
  slideLeft: (cols: FieldNameMetaStore) => void;
  slideRight: (cols: FieldNameMetaStore) => void;
}) {
  const { setHeaderMenuActive } = useTableHeaderContext();
  const { columns, setColumns } = useTableColumnContext();

  const hideColumn = useCallback(
    (field: Field) => {
      const pendingColumnState = { ...columns };
      pendingColumnState[field.name].active = false;
      setColumns(pendingColumnState);
    },
    [columns, setColumns]
  );

  return (
    <LogsTableHeader {...props.headerProps}>
      <div>
        <a onClick={() => hideColumn(props.headerProps.field)}>
          <Icon name={'minus'} size={'xl'} />
          Remove column
        </a>
      </div>
      <div>
        <a
          onClick={() => {
            props.openColumnManagementDrawer();
            setHeaderMenuActive(false);
          }}
        >
          <Icon name={'columns'} size={'xl'} />
          Manage columns
        </a>
      </div>
      <div>
        <a onClick={() => props.slideLeft(columns)}>
          <Icon name={'forward'} size={'xl'} />
          Move forward
        </a>
      </div>
      <div>
        <a onClick={() => props.slideRight(columns)}>
          <Icon name={'backward'} size={'xl'} />
          Move backward
        </a>
      </div>
    </LogsTableHeader>
  );
}
