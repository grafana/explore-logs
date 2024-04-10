import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { LineFilter } from '../LineFilter';
import { getTablePanel } from '@/components/Explore/panels/tablePanel';
import { VAR_FIELDS } from '@/utils/shared';
import { AdHocVariableFilter } from '@grafana/data';

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
    const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
    const filters = fields.state.filters;
    const addFilter = (filter: AdHocVariableFilter) => {
      fields.setState({
        filters: [...filters, filter],
      });
    };
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(filters, addFilter),
      });
    }
  }

  private getVizPanel(filters: AdHocVariableFilter[], addFilter: (filter: AdHocVariableFilter) => void) {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new LineFilter(),
          ySizing: 'content',
        }),
        new SceneFlexItem({
          height: 'calc(100vh - 220px)',
          body: getTablePanel(filters, addFilter),
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
