import {
  CustomVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { Field, Icon, Input } from '@grafana/ui';
import { css } from '@emotion/css';
import { PATTERNS_TEXT_FILTER } from '../../../services/variables';
import { PatternsBreakdownScene } from './PatternsBreakdownScene';
import { debouncedFuzzySearch } from '../../../services/search';

export interface PatternsViewTextSearchState extends SceneObjectState {
  patternFilter?: string;
}

export class PatternsViewTextSearch extends SceneObjectBase<PatternsViewTextSearchState> {
  public static Component = PatternTextSearchComponent;

  constructor(state: PatternsViewTextSearchState) {
    super({
      ...state,
      patternFilter: state.patternFilter,
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: PATTERNS_TEXT_FILTER, value: state.patternFilter ?? '' })],
      }),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  /**
   * On click callback to clear current text search
   */
  public clearSearch = () => {
    this.setState({
      patternFilter: undefined,
    });
  };

  /**
   * Search input onchange callback
   * @param e
   */
  public handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      patternFilter: e.target.value,
    });
  };

  /**
   * Activation handler
   * @private
   */
  private onActivate() {
    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (newState.patternFilter !== prevState.patternFilter) {
          const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          if (parent.state.patternFrames) {
            debouncedFuzzySearch(
              parent.state.patternFrames.map((frame) => frame.pattern),
              this.state.patternFilter ?? '',
              this.onSearchResult
            );
          }
        }
      })
    );
  }

  /**
   * Sets the patterns filtered by string match
   * @param patterns
   */
  setFilteredPatterns(patterns: string[]) {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    if (parent.state.patternFrames) {
      const filteredPatternFrames = parent.state.patternFrames.filter((patternFrame) => {
        if (this.state.patternFilter && parent.state.patternFrames?.length) {
          return patterns.find((pattern) => pattern === patternFrame.pattern);
        }
        return false;
      });

      parent.setState({
        filteredPatterns: filteredPatternFrames,
      });
    }
  }

  /**
   * Fuzzy search callback
   * @param data
   */
  onSearchResult = (data: string[][]) => {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    // If we have a search string
    if (this.state.patternFilter) {
      this.setFilteredPatterns(data[0]);
    } else if (parent.state.filteredPatterns && !this.state.patternFilter) {
      // Wipe the parent filtered state
      this.setEmptySearch();
    }
  };

  /**
   * Wipes filtered patterns when search string is empty
   */
  private setEmptySearch() {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    parent.setState({
      filteredPatterns: undefined,
    });
  }
}

const styles = {
  input: css({}),
  field: css({
    label: 'field',
    marginBottom: 0,
  }),
  icon: css({
    cursor: 'pointer',
  }),
};

export function PatternTextSearchComponent({ model }: SceneComponentProps<PatternsViewTextSearch>) {
  const { patternFilter } = model.useState();
  return (
    <Field className={styles.field}>
      <Input
        suffix={<Icon onClick={model.clearSearch} className={styles.icon} name={'x'} />}
        prefix={<Icon name="search" />}
        className={styles.input}
        onChange={model.handleSearchChange}
        placeholder={'Search patterns'}
        value={patternFilter ?? ''}
      />
    </Field>
  );
}
