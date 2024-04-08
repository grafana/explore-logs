import { PanelBuilders, SceneDataTransformer } from '@grafana/scenes';
import { FieldType } from '@grafana/data';
import { Button, CustomCellRendererProps } from '@grafana/ui';
import React from 'react';

export function getTablePanel() {
  return PanelBuilders.table()
    .setTitle('Logs table')
    .setData(
      new SceneDataTransformer({
        transformations: [
          {
            id: 'extractFields',
            options: {
              source: 'labels',
              format: 'auto',
              replace: false,
              keepTime: false,
            },
          },
        ],
      })
    )
    .build();
}

// .setCustomFieldConfig('cellOptions', {
//   //@ts-ignore
//   type: TableCellDisplayMode.Custom,
//   cellComponent: (props: CustomCellRendererProps) => <CustomCell {...props} filterIn={() => {}} />,
// })

export const CustomCell = (props: CustomCellRendererProps & { filterIn: (label: string, value: unknown) => void }) => {
  if (props.field.type !== FieldType.other) {
    return (
      <div>
        <>{props.value}</>
        <Button onClick={() => props.filterIn(props.field.name, props.value)}>+</Button>
      </div>
    );
  }

  return <div>{JSON.stringify(props.value)}</div>;
};
