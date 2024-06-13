import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { ByFrameRepeater } from './ByFrameRepeater';
import { DataFrame } from '@grafana/data';
import { SearchInput } from './SearchInput';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { FieldsBreakdownScene } from './FieldsBreakdownScene';
import { fuzzySearch } from '../../../services/search';

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
          let haystack: string[] = [];

          child.iterateFrames((frames, seriesIndex) => {
            const labelValue = getLabelValue(frames[seriesIndex]);
            haystack.push(labelValue);
          });
          fuzzySearch(haystack, filter, (data) => {
            if (data && data[0]) {
              // We got search results
              child.filterFrames((frame: DataFrame) => {
                const label = getLabelValue(frame);
                return data[0].includes(label);
              });
            } else {
              // reset search
              child.filterFrames(() => true);
            }
          });
        }
      });
    }
  }
}

export function getLabelValue(frame: DataFrame) {
  const labels = frame.fields[1]?.labels;

  if (!labels) {
    return 'No labels';
  }

  const keys = Object.keys(labels);
  if (keys.length === 0) {
    return 'No labels';
  }

  return labels[keys[0]];
}
