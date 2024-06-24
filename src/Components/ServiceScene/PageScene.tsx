import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { PageLayoutType } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import React from 'react';

interface PageSceneState extends SceneObjectState {
  body: SceneObject;
  title: string;
}
export class PageScene extends SceneObjectBase<PageSceneState> {
  constructor(state: PageSceneState) {
    super({
      body: state.body,
      title: state.title,
    });
  }
  public static Component = ({ model }: SceneComponentProps<PageScene>) => {
    const { body, title } = model.useState();
    return (
      //@todo needs to be fixed, competes with scenes breadcrumb management
      <PluginPage pageNav={{ text: title }} layout={PageLayoutType.Custom}>
        <body.Component model={body} />
      </PluginPage>
    );
  };
}
