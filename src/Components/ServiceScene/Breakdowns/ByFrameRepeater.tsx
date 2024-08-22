import React from 'react';

import { DataFrame, LoadingState, PanelData } from '@grafana/data';
import {
  SceneByFrameRepeater,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneLayout,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { sortSeries } from 'services/sorting';
import { fuzzySearch } from '../../../services/search';
import { getLabelValue } from './SortByScene';
import { Alert, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { BreakdownSearchReset } from './BreakdownSearchScene';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(frame: DataFrame, frameIndex: number): SceneFlexItem;
}

type FrameFilterCallback = (frame: DataFrame) => boolean;
type FrameIterateCallback = (frames: DataFrame[], seriesIndex: number) => void;

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  private unfilteredChildren: SceneFlexItem[] = [];
  private sortBy: string;
  private direction: string;
  private sortedSeries: DataFrame[] = [];
  private getFilter: () => string;
  public constructor({
    sortBy,
    direction,
    getFilter,
    ...state
  }: ByFrameRepeaterState & { sortBy: string; direction: string; getFilter: () => string }) {
    super(state);

    this.sortBy = sortBy;
    this.direction = direction;
    this.getFilter = getFilter;

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
      const layoutChild = this.state.getLayoutChild(sortedSeries[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.sortedSeries = sortedSeries;
    this.unfilteredChildren = newChildren;

    if (this.getFilter()) {
      this.state.body.setState({ children: [] });
      this.filterByString(this.getFilter());
    } else {
      this.state.body.setState({ children: newChildren });
    }
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
      this.state.body.setState({ children: [buildNoResultsScene(this.getFilter(), this.clearFilter)] });
    } else {
      this.state.body.setState({ children: newChildren });
    }
  };

  public clearFilter = () => {
    this.publishEvent(new BreakdownSearchReset(), true);
  };

  public static Component = ({ model }: SceneComponentProps<SceneByFrameRepeater>) => {
    const { body } = model.useState();
    return <body.Component model={body} />;
  };
}

function buildNoResultsScene(filter: string, clearFilter: () => void) {
  return new SceneFlexLayout({
    direction: 'row',
    children: [
      new SceneFlexItem({
        body: new SceneReactObject({
          reactNode: (
            <div className={styles.alertContainer}>
              <Alert title="" severity="info" className={styles.noResultsAlert}>
                No values found matching &ldquo;{filter}&rdquo;
                <Button className={styles.clearButton} onClick={clearFilter}>
                  Clear filter
                </Button>
              </Alert>
            </div>
          ),
        }),
      }),
    ],
  });
}

const styles = {
  alertContainer: css({
    flexGrow: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  }),
  noResultsAlert: css({
    minWidth: '30vw',
    flexGrow: 0,
  }),
  clearButton: css({
    marginLeft: '1.5rem',
  }),
};
