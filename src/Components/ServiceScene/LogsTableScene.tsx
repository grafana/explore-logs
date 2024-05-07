import React from 'react';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneGridItem,
  SceneGridLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneTimeRange,
} from '@grafana/scenes';
import { CustomCellRendererProps, Stack, TableCellDisplayMode } from '@grafana/ui';

export interface TableColumnsSceneState extends SceneObjectState {
  // Column index, column fieldname
  columns: string[];
  body: EmbeddedScene;
  transformer?: SceneDataTransformer;
  panel?: SceneObject;
}

// Currently unused, from old implementation
export class TableColumnsScene extends SceneObjectBase<TableColumnsSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['columns'] });

  constructor(state: Partial<TableColumnsSceneState>) {
    super({
      columns: state.columns ?? [],
      body: new EmbeddedScene({
        body: {
          //@ts-ignore
          children: [],
        },
      }),
      $data: state.$data,
    });

    console.log('data', state.$data);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<TableColumnsScene>) => {
    console.log('Component render');
    const { body } = model.useState();

    return (
      <Stack>
        <body.Component model={body} />
      </Stack>
    );
  };

  getUrlState() {
    console.log('getUrlState', this.state.columns);
    return { columns: JSON.stringify(this.state.columns) };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    console.log('updateFromUrl', values);
    if (typeof values.columns === 'string') {
      const decoded: string[] = JSON.parse(values.columns);
      if (decoded !== this.state.columns) {
        this.setState({
          columns: decoded,
        });
      }
    }
  }

  private _onActivate() {
    this.getTablePanel();
    this.setTableView();
    this.subscribeToState((newState, prevState) => {
      if (prevState.columns !== newState.columns) {
        // can we update data only without re-initing table.
        console.log('is our data here', this.state.panel);
        this.state.panel?.setState({
          $data: this.buildTransformerFromColumns(),
        });

        ///this.state.body.state.$data?.setState()
      }
      console.log('state change', newState);
    });
  }

  private setTableView() {
    const { body } = this.state;
    body.setState({
      $timeRange: new SceneTimeRange({
        from: 'now-1h',
        to: 'now',
      }),
      body: new SceneGridLayout({
        children: [
          new SceneGridItem({
            height: 8,
            width: 20,
            x: 0,
            y: 0,
            body: this.state.panel,
          }),
        ],
      }),
    });
  }

  private buildTransformerFromColumns() {
    let excludeByName: Record<string, boolean> = {};
    this.state.columns.forEach((col) => {
      excludeByName[col] = true;
    });

    return new SceneDataTransformer({
      transformations: [
        {
          id: 'extractFields',
          options: {
            format: 'json',
            keepTime: false,
            replace: false,
            source: 'labels',
          },
        },
        {
          id: 'organize',
          options: {
            excludeByName,
            // indexByName: this.state.columns,
            // renameByName: {},
          },
        },
      ],
    });
  }

  private getTablePanel() {
    const panel = PanelBuilders.table()
      .setTitle('Table')
      .setData(this.buildTransformerFromColumns())
      .setOverrides((field) => {
        // @todo why does overrideCustomFieldConfig not work without the matchFieldsWithNameByRegex?
        field.matchFieldsWithNameByRegex('/.+/').overrideCustomFieldConfig('cellOptions', {
          // Types are incorrect in scenes, but the Custom cell mode appears to work
          // @ts-ignore
          type: TableCellDisplayMode.Custom,
          cellComponent: (props: CustomCellRendererProps) => {
            return (
              <>
                {/*Want to set state of transformations on click, exclude this field*/}
                <a
                  style={{
                    border: '1px solid red',
                  }}
                  onClick={() => {
                    console.log('field', props.field.name, props.rowIndex);
                    this.setState({
                      columns: [...this.state.columns, props.field.name],
                    });
                  }}
                >
                  hide column
                </a>
                <span>{typeof props.value === 'string' ? props.value : JSON.stringify(props.value)}</span>
              </>
            );
          },
        });
        field.overrideCustomFieldConfig('filterable', true);
        // Doesn't work, headerComponent not supported in scenes?
        // field.overrideCustomFieldConfig('headerComponent', (props: CustomHeaderRendererProps) => (
        //     <div>
        //         <span>{props.defaultContent}</span>
        //         <span
        //             onClick={(e) => {
        //                 console.log('click')
        //             }}
        //         >
        //     <Icon title={'Show menu'} name={'ellipsis-v'}/>
        // </span>
        //     </div>
        // ))
      });

    // this.panel = panel;
    this.setState({
      panel: panel.build(),
    });
  }
}
