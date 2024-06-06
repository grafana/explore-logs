import React from 'react';

import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { LineFilter } from './LineFilter';
import { LogsVolumePanel } from './LogsVolumePanel';
import { css } from '@emotion/css';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }
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
          body: PanelBuilders.logs()
            .setOption('showLogContextToggle', true)
            .setOption('showTime', true)
            .setHoverHeader(true)
            .build(),
        }),
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return (
      <div className={styles.panelWrapper}>
        <panel.Component model={panel} />
      </div>
    );
  };
}

export function buildLogsListScene() {
  return new SceneFlexLayout({
    direction: 'column',

    // ySizing: '',
    children: [
      new SceneFlexItem({
        minHeight: 200,
        body: new LogsVolumePanel({}),
      }),
      new SceneFlexItem({
        minHeight: '470px',
        height: 'calc(100vh - 500px)',
        body: new LogsListScene({}),
      }),
    ],
  });
}

const styles = {
  panelWrapper: css({
    // If you use hover-header without any header options we must manually hide the remnants, or it shows up as a 1px line in the top-right corner of the viz
    '.show-on-hover': {
      display: 'none',
    },
  }),
};
