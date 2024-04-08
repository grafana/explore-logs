import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { LineFilter } from '../LineFilter';
import { CustomCellRendererProps, TableCellDisplayMode } from '@grafana/ui';
import { map, Observable } from 'rxjs';
import { BusEventWithPayload, DataFrame } from '@grafana/data';
import { DefaultCellComponent } from '../../panels/table/DefaultCellComponent';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };

  public _onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }

    this.subscribeToEvent(LogsCellFilterIn, (event) => {
      console.log('tableCellFilterIn event', event);
    });
  }

  private getVizPanel() {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new LineFilter(),
          ySizing: 'content',
        }),
        new SceneFlexItem({
          height: 'calc(100vh - 220px)',
          body: PanelBuilders.table()
            .setTitle('Logs table')
            .setCustomFieldConfig('cellOptions', {
              //@ts-ignore
              type: TableCellDisplayMode.Custom,
              cellComponent: (props: CustomCellRendererProps) => (
                <DefaultCellComponent
                  setActiveCellIndex={() => {}}
                  cellIndex={{ index: 0 }}
                  setVisible={() => {}}
                  {...props}
                />
              ),
            })
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
                  () => (source: Observable<DataFrame[]>) => {
                    return source.pipe(
                      map((data: DataFrame[]) => {
                        return data;
                      })
                    );
                  },
                ],
              })
            )
            .build(),
        }),
      ],
    });
  }
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({}),
  });
}

type LogsCellFilterInPayload = { label: string; value: unknown };
export class LogsCellFilterIn extends BusEventWithPayload<LogsCellFilterInPayload> {
  constructor(payload: LogsCellFilterInPayload) {
    super(payload);
  }

  public static type = 'tableCellFilterIn';
}
