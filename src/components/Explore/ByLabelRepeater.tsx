import React from 'react';

import { LoadingState, PanelData, DataFrame, FieldType } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneLayout,
} from '@grafana/scenes';

interface ByLabelRepeaterState extends SceneObjectState {
  body: SceneLayout;
  repeatByLabel: string;
  filter?: string;
  getLayoutChild(data: PanelData, frames: DataFrame[], value: string, index: number): SceneFlexItem;
}

export class ByLabelRepeater extends SceneObjectBase<ByLabelRepeaterState> {
  public constructor(state: ByLabelRepeaterState, limit?: number) {
    super(state);

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data, limit);
          }
        })
      );

      this._subs.add(
        this.subscribeToState((state, prevState) => {
          const data = sceneGraph.getData(this).state.data;
          if (state.filter !== prevState.filter && data?.state === LoadingState.Done) {
            this.performRepeat(sceneGraph.getData(this).state.data!, limit);
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data, limit);
      }
    });
  }

  private performRepeat(data: PanelData, limit?: number) {
    let newChildren: SceneFlexItem[] = [];

    const labelValue2series: Record<string, DataFrame[]> = {};

    data.series.forEach((frame) => {
      const valueField = frame.fields.find((f) => f.type === FieldType.number);
      const labelValue = valueField?.labels?.[this.state.repeatByLabel];
      if (labelValue) {
        if (this.state.filter && !labelValue.includes(this.state.filter)) {
          return;
        }
        if (!labelValue2series[labelValue]) {
          labelValue2series[labelValue] = [];
        }
        labelValue2series[labelValue].push(frame);
      }
    });

    Object.entries(labelValue2series).forEach(([value, frames], index) => {
      const layoutChild = this.state.getLayoutChild(data, frames, value, index);
      newChildren.push(layoutChild);
    });

    if(limit && limit > 0){
      newChildren = newChildren.slice(0, limit)
    }

    this.state.body.setState({ children: newChildren });
  }

  public static Component = ({ model }: SceneComponentProps<ByLabelRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
