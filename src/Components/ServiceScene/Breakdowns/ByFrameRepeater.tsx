import React from 'react';

import { LoadingState, PanelData, DataFrame, doStandardCalcs, fieldReducers, ReducerID } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneByFrameRepeater,
  SceneLayout,
} from '@grafana/scenes';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem;
}

type FrameFilterCallback = (frame: DataFrame) => boolean;
type FrameIterateCallback = (frames: DataFrame[], seriesIndex: number) => void;

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  private unfilteredChildren: SceneFlexItem[];
  public constructor(state: ByFrameRepeaterState) {
    super(state);

    this.unfilteredChildren = [];

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data);
      }
    });
  }

  private performRepeat(data: PanelData) {
    const newChildren: SceneFlexItem[] = [];

    const reducer = fieldReducers.get(ReducerID.stdDev);

    const fieldCalcs = data.series.map((dataFrame) => ({
      calcs: doStandardCalcs(dataFrame.fields[1], true, true),
      stdDev: reducer.reduce?.(dataFrame.fields[1], true, true) ?? { stdDev: 0, variance: 0 },
      field: dataFrame,
    }));

    fieldCalcs.sort((a, b) => {
      if (b.calcs.allIsNull || b.calcs.allIsZero) {
        return -1;
      }
      return b.stdDev.stdDev - a.stdDev.stdDev;
    });

    for (let seriesIndex = 0; seriesIndex < fieldCalcs.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, fieldCalcs[seriesIndex].field, seriesIndex);
      newChildren.push(layoutChild);
    }

    this.state.body.setState({ children: newChildren });
    this.unfilteredChildren = newChildren;
  }

  public iterateFrames = (callback: FrameIterateCallback) => {
    const data = sceneGraph.getData(this).state.data;
    if (!data) {
      return;
    }
    for (let seriesIndex = 0; seriesIndex < data.series.length; seriesIndex++) {
      callback(data.series, seriesIndex);
    }
  };

  public filterFrames = (filterFn: FrameFilterCallback) => {
    const newChildren: SceneFlexItem[] = [];
    this.iterateFrames((frames, seriesIndex) => {
      if (filterFn(frames[seriesIndex])) {
        newChildren.push(this.unfilteredChildren[seriesIndex]);
      }
    });

    this.state.body.setState({ children: newChildren });
  };

  public static Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}
