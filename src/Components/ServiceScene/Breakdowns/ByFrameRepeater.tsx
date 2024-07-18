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
import { Alert, Button } from '@grafana/ui';
import { css } from '@emotion/css';
import { BreakdownSearchReset } from './BreakdownSearchScene';

interface ByFrameRepeaterState extends SceneObjectState {
  body: SceneLayout;
  getLayoutChild(data: PanelData, frame: DataFrame, frameIndex: number): SceneFlexItem;
}

type FrameFilterCallback = (frame: DataFrame) => boolean;
type FrameIterateCallback = (frames: DataFrame[], seriesIndex: number) => void;

export class ByFrameRepeater extends SceneObjectBase<ByFrameRepeaterState> {
  private unfilteredChildren: SceneFlexItem[] = [];
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

    this.addActivationHandler(() => {
      const data = sceneGraph.getData(this);

      this._subs.add(
        data.subscribeToState((data) => {
          if (data.data?.state === LoadingState.Done) {
            this.performRepeat(data.data, 'sub');
          }
        })
      );

      if (data.state.data) {
        this.performRepeat(data.state.data, 'data');
      }
    });
  }

  public sort = (sortBy: string, direction: string) => {
    const data = sceneGraph.getData(this);
    this.sortBy = sortBy;
    this.direction = direction;
    if (data.state.data) {
      this.performRepeat(data.state.data, 'sort');
    }
  };

  private performRepeat(data: PanelData, source = 'unknown') {
    console.log('performRepeat', source);
    const newChildren: SceneFlexItem[] = [];
    const sortedSeries = sortSeries(data.series, this.sortBy, this.direction);

    for (let seriesIndex = 0; seriesIndex < sortedSeries.length; seriesIndex++) {
      const layoutChild = this.state.getLayoutChild(data, sortedSeries[seriesIndex], seriesIndex);
      newChildren.push(layoutChild);
    }

    this.sortedSeries = sortedSeries;
    this.unfilteredChildren = newChildren;

    if (this.filter) {
      this.state.body.setState({ children: [] });
      this.filterByString(this.filter);
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
    console.log('filterByString');
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
    console.log('filterFrames');
    const newChildren: SceneFlexItem[] = [];
    this.iterateFrames((frames, seriesIndex) => {
      if (filterFn(frames[seriesIndex])) {
        newChildren.push(this.unfilteredChildren[seriesIndex]);
      }
    });

    if (newChildren.length === 0) {
      this.state.body.setState({ children: [buildNoResultsScene(this.filter, this.clearFilter)] });
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
