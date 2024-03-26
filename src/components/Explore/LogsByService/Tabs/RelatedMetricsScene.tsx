import React from 'react';

import {
  SceneCanvasText,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';

export interface RelatedMetricsSceneState extends SceneObjectState {
  body: SceneObject;
}

export class RelatedMetricsScene extends SceneObjectBase<RelatedMetricsSceneState> {
  constructor(state: Partial<RelatedMetricsSceneState>) {
    super({
      body:
        state.body ??
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              body: new SceneCanvasText({
                text: 'Work in progress',
                fontSize: 20,
                align: 'center',
              }),
            }),
          ],
        }),
      ...state,
    });
  }

  public static Component = ({ model }: SceneComponentProps<RelatedMetricsScene>) => {
    const { body } = model.useState();
    return body && <body.Component model={body} />;
  };
}

export function buildRelatedMetricsScene() {
  return new SceneFlexItem({
    body: new RelatedMetricsScene({}),
  });
}
