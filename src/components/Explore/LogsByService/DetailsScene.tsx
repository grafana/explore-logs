import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneFlexItem,
  SceneCanvasText,
  SceneFlexLayout,
} from '@grafana/scenes';
import { getLogViewPanel } from '../panels/logsViewPanel';
import { DetailsSceneUpdated } from '../../../utils/shared';

export interface DetailsSceneState extends SceneObjectState {
  logId?: string;

  body: SceneFlexLayout;
}

export class DetailsScene extends SceneObjectBase<DetailsSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['logId'] });

  constructor(state: Partial<DetailsSceneState>) {
    super({
      logId: state.logId ?? '',
      body: new SceneFlexLayout({ children: [] }),
    });

    this.addActivationHandler(this._onActivate.bind(this));
    this.subscribeToState((newState, prevState) => {
      if (newState.logId !== prevState.logId) {
        this.updateBody();
        this.publishEvent(new DetailsSceneUpdated(), true);
      }
    });
  }

  private _onActivate() {
    this.updateBody();
  }

  getUrlState() {
    return { logId: this.state.logId };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<DetailsSceneState> = {};

    if (typeof values.logId === 'string' && values.logId !== this.state.logId) {
      stateUpdate.logId = values.logId;
    }

    this.setState(stateUpdate);
  }

  private updateBody() {
    if (this.state.logId) {
      this.state.body.setState({
        children: [
          new SceneFlexItem({
            body: getLogViewPanel(this.state.logId),
          }),
        ],
      });
    } else {
      this.state.body.setState({
        children: [
          new SceneCanvasText({
            text: 'No details available',
            fontSize: 20,
            align: 'center',
          }),
        ],
      });
    }
  }

  public static Component = ({ model }: SceneComponentProps<DetailsScene>) => {
    const { body } = model.useState();
    return body && <body.Component model={body} />;
  };
}
