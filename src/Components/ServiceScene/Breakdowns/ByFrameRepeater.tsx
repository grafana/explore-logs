import React from 'react';

import { LoadingState, PanelData, DataFrame, FieldType, fieldReducers, doStandardCalcs } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneByFrameRepeater,
  SceneLayout,
} from '@grafana/scenes';
import { ChangepointDetector } from '@bsull/augurs';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem;
}

type FrameFilterCallback = (frame: DataFrame) => boolean;
type FrameIterateCallback = (frames: DataFrame[], seriesIndex: number) => void;

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  private unfilteredChildren: SceneFlexItem[];
  private sortBy: string;
  private direction: string;
  public constructor({ sortBy, direction, ...state }: ByFrameRepeaterState & { sortBy: string; direction: string }) {
    super(state);

    this.sortBy = sortBy;
    this.direction = direction;

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

  public sort = (sortBy: string, direction: string) => {
    const data = sceneGraph.getData(this);
    // Do not re-calculate when only the direction changes
    if (sortBy === this.sortBy && this.direction !== direction) {
      this.direction = direction;
      this.state.body.setState({ children: this.state.body.state.children.reverse() });
      return;
    }
    this.sortBy = sortBy;
    this.direction = direction;
    if (data.state.data) {
      this.performRepeat(data.state.data);
    }
  };

  private getSortedSeries = (data: PanelData) => {
    const reducer = (dataFrame: DataFrame) => {
      if (this.sortBy === 'changepoint') {
        return this.calculateChangepointsValue(dataFrame);
      }
      const fieldReducer = fieldReducers.get(this.sortBy);
      const value =
        fieldReducer.reduce?.(dataFrame.fields[1], true, true) ?? doStandardCalcs(dataFrame.fields[1], true, true);
      return value[this.sortBy] ?? 0;
    };

    const seriesCalcs = data.series.map((dataFrame) => ({
      value: reducer(dataFrame),
      dataFrame: dataFrame,
    }));

    seriesCalcs.sort((a, b) => {
      if (a.value && b.value) {
        return b.value - a.value;
      }
      return 0;
    });

    if (this.direction === 'asc') {
      seriesCalcs.reverse();
    }

    return seriesCalcs.map(({ dataFrame }) => dataFrame);
  };

  private calculateChangepointsValue = (data: DataFrame) => {
    const fields = data.fields.filter((f) => f.type === FieldType.number);
    const values = new Float64Array(fields[0].values);
    const points = ChangepointDetector.defaultArgpcp().detectChangepoints(values);
    return points.indices.length;
  };

  private performRepeat(data: PanelData) {
    const newChildren: SceneFlexItem[] = [];
    const sortedSeries = this.getSortedSeries(data);

    for (let seriesIndex = 0; seriesIndex < sortedSeries.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, sortedSeries[seriesIndex], seriesIndex);
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
    const sortedSeries = this.getSortedSeries(data);
    for (let seriesIndex = 0; seriesIndex < sortedSeries.length; seriesIndex++) {
      callback(sortedSeries, seriesIndex);
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
