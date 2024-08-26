import React from 'react';

import { SceneComponentProps, SceneFlexLayout, SceneObjectBase } from '@grafana/scenes';
import { LogsListSceneState } from '../LogsListScene';
import { LogOptionsScene } from '../LogOptionsScene';

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
      visualizationType: 'logs',
      panel: new SceneFlexLayout({
        children: [new LogOptionsScene()],
      }),
      displayedFields: [],
    });
  }

  public updateLogsPanel = jest.fn();

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();
    if (!panel) {
      return null;
    }
    return (
      <div>
        <panel.Component model={panel} />
      </div>
    );
  };
}
