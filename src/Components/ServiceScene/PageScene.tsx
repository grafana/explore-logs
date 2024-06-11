import {
  AdHocFiltersVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { PageLayoutType } from '@grafana/data';
import { PluginPage } from '@grafana/runtime';
import React from 'react';
import { VAR_FILTERS } from '../../services/variables';
import { prefixRoute, ROUTES } from '../../services/routing';

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
    const vars = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;
    const { filters } = vars.useState();
    const serviceName = filters?.[0].value;

    const parentNav = serviceName
      ? {
          text: serviceName,
          // Core will dedupe breadcrumbs with the same url, appending an anchor link so we can get the service name, even though it links to same location as "Logs" breadcrumb
          url: prefixRoute(ROUTES.Explore) + '#',
        }
      : undefined;

    return (
      <PluginPage
        pageNav={{
          text: title,
          parentItem: parentNav,
        }}
        layout={PageLayoutType.Custom}
      >
        <body.Component model={body} />
      </PluginPage>
    );
  };
}
