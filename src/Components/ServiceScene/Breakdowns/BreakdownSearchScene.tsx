import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { ByFrameRepeater } from './ByFrameRepeater';
import { SearchInput } from './SearchInput';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { FieldsBreakdownScene } from './FieldsBreakdownScene';
import { BusEventBase } from '@grafana/data';
import { LabelValuesBreakdownScene } from './LabelValuesBreakdownScene';
import { FieldValuesBreakdownScene } from './FieldValuesBreakdownScene';

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
    if (this.parent instanceof LabelBreakdownScene || this.parent instanceof FieldsBreakdownScene) {
      recentFilters[this.cacheKey] = filter;
      const body = this.parent.state.body;
      if (body instanceof LabelValuesBreakdownScene || body instanceof FieldValuesBreakdownScene) {
        body.state.body?.forEachChild((child) => {
          if (child instanceof ByFrameRepeater && child.state.body.isActive) {
            child.filterByString(filter);
          }
        });
      } else {
        console.warn('invalid parent for search', body);
      }
    }
  }
}
