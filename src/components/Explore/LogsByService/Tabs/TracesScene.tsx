import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { dateTime, LoadingState } from '@grafana/data';
import { tracesFrame } from './traces-list';

export interface TracesSceneState extends SceneObjectState {
  body: SceneObject;
}

export class TracesScene extends SceneObjectBase<TracesSceneState> {
  constructor(state: Partial<TracesSceneState>) {
    super({
      body:
        state.body ??
        new SceneFlexLayout({
          children: [
            new SceneFlexItem({
              body: PanelBuilders.table()
                .setTitle('Traces')
                .setData(
                  new SceneDataNode({
                    data: {
                      series: [tracesFrame],
                      state: LoadingState.Done,
                      timeRange: {
                        from: dateTime(),
                        to: dateTime(),
                        raw: { from: dateTime(), to: dateTime() },
                      },
                    },
                  })
                )
                .build(),
            }),
          ],
        }),
      ...state,
    });
  }

  public static Component = ({ model }: SceneComponentProps<TracesScene>) => {
    const { body } = model.useState();
    return body && <body.Component model={body} />;
  };
}

export function buildTracesScenes() {
  return new SceneFlexItem({
    body: new TracesScene({}),
  });
}
