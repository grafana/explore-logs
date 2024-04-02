import {
  SceneComponentProps,
  SceneCSSGridLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectStateChangedEvent,
} from '@grafana/scenes';
import { TableProvider } from '../Table/TableProvider';
import React from 'react';
import { StoreContextWrapper } from '../Context';
import { DataFrame } from '@grafana/data';

export interface TablePanelState extends SceneObjectState {
  body: SceneCSSGridLayout;
  dataFrame: DataFrame[] | undefined;
}

export class TablePanel extends SceneObjectBase<TablePanelState> {
  constructor(state: Partial<TablePanelState>) {
    super({
      body: state.body ?? new SceneCSSGridLayout({ children: [] }),
      $variables: state.$variables,
      dataFrame: undefined,
    });
    this.addActivationHandler(this._onActivate.bind(this));
    this.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      console.log('event', event);
    });
  }

  private _onActivate() {
    const graphData = sceneGraph.getData(this);
    console.log('onActiveate', graphData.state.data?.series);

    this.setState({
      body: this.buildBody(),
      dataFrame: graphData.state.data?.series,
    });
  }

  public static Component(props: SceneComponentProps<SceneObject<TablePanelState>>): React.ReactElement | null {
    console.log('Component props, need dataframe', props);
    return (
      <>
        <StoreContextWrapper>
          <TableProvider dataFrame={props?.model?.state?.dataFrame?.[0] ?? undefined} />
        </StoreContextWrapper>
      </>
    );
  }

  private buildBody() {
    const body = new SceneCSSGridLayout({
      children: [],
    });

    return body;
  }
}
