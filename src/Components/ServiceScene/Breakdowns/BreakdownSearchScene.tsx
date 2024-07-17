import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { ByFrameRepeater } from './ByFrameRepeater';
import { SearchInput } from './SearchInput';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { FieldsBreakdownScene } from './FieldsBreakdownScene';
import { BusEventBase } from '@grafana/data';

export class BreakdownSearchReset extends BusEventBase {
  public static type = 'breakdown-search-reset';
}

export interface BreakdownSearchSceneState extends SceneObjectState {
  filter?: string;
}

export class BreakdownSearchScene extends SceneObjectBase<BreakdownSearchSceneState> {
  constructor() {
    super({
      filter: '',
    });
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

  private filterValues(filter: string) {
    if (this.parent instanceof LabelBreakdownScene || this.parent instanceof FieldsBreakdownScene) {
      const body = this.parent.state.body;
      body?.forEachChild((child) => {
        if (child instanceof ByFrameRepeater && child.state.body.isActive) {
          child.filterByString(filter);
        }
      });
    }
  }
}
