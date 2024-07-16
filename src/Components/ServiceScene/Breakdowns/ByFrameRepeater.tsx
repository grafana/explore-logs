import React from 'react';

import { LoadingState, PanelData, DataFrame } from '@grafana/data';
import {
  SceneObjectState,
  SceneFlexItem,
  SceneObjectBase,
  sceneGraph,
  SceneComponentProps,
  SceneByFrameRepeater,
  SceneLayout,
  SceneFlexLayout,
  SceneReactObject,
} from '@grafana/scenes';
import { sortSeries } from 'services/sorting';
import { fuzzySearch } from '../../../services/search';
import { getLabelValue } from './SortByScene';
import { Alert } from '@grafana/ui';
import { css } from '@emotion/css';

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
  private sortedSeries: DataFrame[] = [];
  private filter: string;
  public constructor({
    sortBy,
    direction,
    filter = '',
    ...state
  }: ByFrameRepeaterState & { sortBy: string; direction: string; filter: string }) {
    super(state);

    this.sortBy = sortBy;
    this.direction = direction;
    this.filter = filter;

    this.unfilteredChildren = [];

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data);
            if (this.filter) {
              this.filterByString(filter);
            }
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data);
        if (this.filter) {
          this.filterByString(filter);
        }
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

  private performRepeat(data: PanelData) {
    const newChildren: SceneFlexItem[] = [];
    const sortedSeries = sortSeries(data.series, this.sortBy, this.direction);

    for (let seriesIndex = 0; seriesIndex < sortedSeries.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, sortedSeries[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.sortedSeries = sortedSeries;
    this.state.body.setState({ children: newChildren });
    this.unfilteredChildren = newChildren;
  }

  public iterateFrames = (callback: FrameIterateCallback) => {
    const data = sceneGraph.getData(this).state.data;
    if (!data) {
      return;
    }
    for (let seriesIndex = 0; seriesIndex < this.sortedSeries.length; seriesIndex++) {
      callback(this.sortedSeries, seriesIndex);
    }
  };

  filterByString = (filter: string) => {
    this.filter = filter;
    let haystack: string[] = [];

    this.iterateFrames((frames, seriesIndex) => {
      const labelValue = getLabelValue(frames[seriesIndex]);
      haystack.push(labelValue);
    });
    fuzzySearch(haystack, filter, (data) => {
      if (data && data[0]) {
        // We got search results
        this.filterFrames((frame: DataFrame) => {
          const label = getLabelValue(frame);
          return data[0].includes(label);
        });
      } else {
        // reset search
        this.filterFrames(() => true);
      }
    });
  };

  public filterFrames = (filterFn: FrameFilterCallback) => {
    const newChildren: SceneFlexItem[] = [];
    this.iterateFrames((frames, seriesIndex) => {
      if (filterFn(frames[seriesIndex])) {
        newChildren.push(this.unfilteredChildren[seriesIndex]);
      }
    });

    if (newChildren.length === 0) {
      this.state.body.setState({ children: [buildNoResultsScene(this.filter)] });
    } else {
      this.state.body.setState({ children: newChildren });
    }
  };

  public static Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

function buildNoResultsScene(filter: string) {
  return new SceneFlexLayout({
    direction: 'row',
    children: [
      new SceneFlexItem({
        body: new SceneReactObject({
          reactNode: (
            <div>
              <Alert title="" severity="info" className={styles.noResultsAlert}>
                <p>No values found matching &ldquo;{filter}&rdquo;.</p>
              </Alert>
            </div>
          ),
        }),
      }),
    ],
  });
}

const styles = {
  noResultsAlert: css({
    minWidth: '50vw',
  }),
};
