import React, { CSSProperties, useMemo } from 'react';
import { SceneComponentProps, SceneCSSGridItem, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LazyLoader } from 'Components/ServiceScene/Breakdowns/LazyLoader';
import { CSSObject, css } from '@emotion/css';

export interface SceneCSSGridItemPlacement {
  /**
   * True when the item should rendered but not visible.
   * Useful for conditional display of layout items
   */
  isHidden?: boolean;
  /**
   * Useful for making content span across multiple rows or columns
   */
  gridColumn?: CSSProperties['gridColumn'];
  gridRow?: CSSProperties['gridRow'];
}

export interface SceneCSSGridItemState extends SceneCSSGridItemPlacement, SceneObjectState {
  body: SceneObject | undefined;
}
interface SceneCSSGridItemRenderProps<T> extends SceneComponentProps<T> {
  parentState?: SceneCSSGridItemPlacement;
}

export class LazySceneCSSGridItem extends SceneObjectBase<SceneCSSGridItemState> {
  public static Component = ({ model, parentState }: SceneCSSGridItemRenderProps<SceneCSSGridItem>) => {
    const { body, isHidden } = model.useState();
    const style = useItemStyle(model.state);
    if (!body || isHidden) {
      return null;
    }
    return (
      <LazyLoader isHidden={isHidden} key={model.state.key!} className={style}>
        <SceneCSSGridItem.Component key={model.state.key} model={model} parentState={model.state} />
      </LazyLoader>
    );
  };
}

function useItemStyle(state: SceneCSSGridItemState) {
  return useMemo(() => {
    const style: CSSObject = {};

    style.gridColumn = state.gridColumn || 'unset';
    style.gridRow = state.gridRow || 'unset';
    // Needed for VizPanel
    style.position = 'relative';
    style.display = 'grid';

    return css(style);
  }, [state]);
}
