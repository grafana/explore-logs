import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent } from 'react';
import { Field, Icon, Input } from '@grafana/ui';
import { css } from '@emotion/css';
import { PatternFrame, PatternsBreakdownScene } from './PatternsBreakdownScene';
import { debouncedFuzzySearch, fuzzySearch } from '../../../services/search';

export interface PatternsViewTextSearchState extends SceneObjectState {}

export class PatternsViewTextSearch extends SceneObjectBase<PatternsViewTextSearchState> {
  public static Component = PatternTextSearchComponent;

  constructor(state?: Partial<PatternsViewTextSearchState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  /**
   * On click callback to clear current text search
   */
  public clearSearch = () => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      patternFilter: '',
    });
  };

  /**
   * Search input onchange callback
   * @param e
   */
  public handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      patternFilter: e.target.value,
    });
  };

  /**
   * Activation handler
   * @private
   */
  private onActivate() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    this._subs.add(
      patternsBreakdownScene.subscribeToState((newState, prevState) => {
        if (newState.patternFilter !== prevState.patternFilter) {
          const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
          if (patternsBreakdownScene.state.patternFrames) {
            debouncedFuzzySearch(
              patternsBreakdownScene.state.patternFrames.map((frame) => frame.pattern),
              patternsBreakdownScene.state.patternFilter,
              this.onSearchResult
            );
          }
        }
      })
    );

    this._subs.add(
      patternsBreakdownScene.subscribeToState((newState, prevState) => {
        // If we have a search string, but no filtered patterns, run the search
        if (
          newState.patternFilter &&
          !newState.filteredPatterns &&
          newState.patternFrames &&
          JSON.stringify(newState.filteredPatterns) !== JSON.stringify(prevState.filteredPatterns)
        ) {
          fuzzySearch(
            newState.patternFrames.map((frame) => frame.pattern),
            newState.patternFilter,
            this.onSearchResult
          );
        }
      })
    );
  }

  /**
   * Sets the patterns filtered by string match
   * @param patterns
   * @param patternFramesOverride
   */
  setFilteredPatterns(patterns: string[], patternFramesOverride?: PatternFrame[]) {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    const patternFrames = patternFramesOverride ?? patternsBreakdownScene.state.patternFrames;

    if (patternFrames) {
      const filteredPatternFrames = patternFrames.filter((patternFrame) => {
        if (patternsBreakdownScene.state.patternFilter && patternFrames?.length) {
          return patterns.find((pattern) => pattern === patternFrame.pattern);
        }
        return false;
      });

      patternsBreakdownScene.setState({
        filteredPatterns: filteredPatternFrames,
      });
    }
  }

  /**
   * Fuzzy search callback
   * @param data
   */
  onSearchResult = (data: string[][]) => {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    // If we have a search string
    if (patternsBreakdownScene.state.patternFilter) {
      this.setFilteredPatterns(data[0]);
    } else if (patternsBreakdownScene.state.filteredPatterns && !patternsBreakdownScene.state.patternFilter) {
      // Wipe the parent filtered state
      this.setEmptySearch();
    }
  };

  /**
   * Wipes filtered patterns when search string is empty
   */
  private setEmptySearch() {
    const patternsBreakdownScene = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    patternsBreakdownScene.setState({
      filteredPatterns: undefined,
    });
  }
}

const styles = {
  field: css({
    label: 'field',
    marginBottom: 0,
  }),
  icon: css({
    cursor: 'pointer',
  }),
};

export function PatternTextSearchComponent({ model }: SceneComponentProps<PatternsViewTextSearch>) {
  const patternsBreakdownScene = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const { patternFilter } = patternsBreakdownScene.useState();
  return (
    <Field className={styles.field}>
      <Input
        suffix={<Icon onClick={model.clearSearch} className={styles.icon} name={'x'} />}
        prefix={<Icon name="search" />}
        onChange={model.handleSearchChange}
        placeholder="Search patterns"
        value={patternFilter}
      />
    </Field>
  );
}
