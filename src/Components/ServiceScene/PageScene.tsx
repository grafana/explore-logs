import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';

interface PageSceneState extends SceneObjectState {
  body: SceneObject;
  title: string;
}
//@todo clean
export class PageScene extends SceneObjectBase<PageSceneState> {
  constructor(state: PageSceneState) {
    super({
      body: state.body,
      title: state.title,
    });
  }
  public static Component = ({ model }: SceneComponentProps<PageScene>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
