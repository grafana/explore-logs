import React from 'react';

import {
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { getLogsPanel } from '../../panels/logsPanel';

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

  public _onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }
  }

  private getVizPanel() {
    return new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          body: getLogsPanel(),
        }),
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({}),
  });
}
