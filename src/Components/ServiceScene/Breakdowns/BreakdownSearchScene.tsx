import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { ByFrameRepeater } from './ByFrameRepeater';
import { SearchInput } from './SearchInput';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { FieldsBreakdownScene } from './FieldsBreakdownScene';
import { BusEventBase } from '@grafana/data';
import { logger } from '../../../services/logger';

export class BreakdownSearchReset extends BusEventBase {
  public static type = 'breakdown-search-reset';
}

export interface BreakdownSearchSceneState extends SceneObjectState {
  filter?: string;
}

const recentFilters: Record<string, string> = {};

export class BreakdownSearchScene extends SceneObjectBase<BreakdownSearchSceneState> {
  private cacheKey: string;
  constructor(cacheKey: string) {
    super({
      filter: recentFilters[cacheKey] ?? '',
    });
    this.cacheKey = cacheKey;
  }

  public static Component = ({ model }: SceneComponentProps<BreakdownSearchScene>) => {
    const { filter } = model.useState();
    return (
      <SearchInput
        value={filter}
        onChange={model.onValueFilterChange}
        onClear={model.clearValueFilter}
        placeholder="Search for value"
      />
    );
  };

  public onValueFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ filter: event.target.value });
    this.filterValues(event.target.value);
  };

  public clearValueFilter = () => {
    this.setState({ filter: '' });
    this.filterValues('');
  };

  public reset = () => {
    this.setState({ filter: '' });
    recentFilters[this.cacheKey] = '';
  };

  private filterValues(filter: string) {
    const breakdownScene = sceneGraph.findObject(
      this,
      (o) => o instanceof LabelBreakdownScene || o instanceof FieldsBreakdownScene
    );
    if (breakdownScene instanceof LabelBreakdownScene || breakdownScene instanceof FieldsBreakdownScene) {
      recentFilters[this.cacheKey] = filter;
      const byFrameRepeater = sceneGraph.findDescendents(breakdownScene, ByFrameRepeater);
      byFrameRepeater?.forEach((child) => {
        if (child.state.body.isActive) {
          child.filterByString(filter);
        }
      });
    } else {
      logger.warn('unable to find Breakdown scene', {
        typeofBody: typeof breakdownScene,
        filter,
      });
    }
  }
}
