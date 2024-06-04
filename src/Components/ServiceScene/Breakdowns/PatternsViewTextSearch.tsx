import {
  CustomVariable,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { PatternsBreakdownScene } from './PatternsBreakdownScene';
import React, { ChangeEvent } from 'react';
import { Input } from '@grafana/ui';
import { css } from '@emotion/css';
import { testIds } from '../../../services/testIds';
import { debounce } from 'lodash';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../services/analytics';
import { PATTERNS_TEXT_FILTER } from '../../../services/variables';
import { debouncedFuzzySearch } from '../../../services/uFuzzy';

export interface PatternsViewTextSearchState extends SceneObjectState {
  patternFilter?: string;
}

export class PatternsViewTextSearch extends SceneObjectBase<PatternsViewTextSearchState> {
  public static Component = PatternTextSearchComponent;
  handleChange = debounce((e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      patternFilter: e.target.value,
    });
    this.updateVariable(e.target.value);
  }, 350);

  constructor(state: PatternsViewTextSearchState) {
    super({
      ...state,
      $variables: new SceneVariableSet({
        variables: [new CustomVariable({ name: PATTERNS_TEXT_FILTER, value: state.patternFilter ?? '' })],
      }),
    });
  }

  /**
   * @todo do we want to set parent filtered frames, or just have one?
   * Currently uncalled
   */
  setFilteredPatterns() {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    if (parent.state.patternFrames) {
      const filteredPatternFrames = parent.state.patternFrames.filter((patternFrame) => {
        if (this.state.patternFilter && parent.state.filteredPatterns?.length) {
          return parent.state.filteredPatterns.find((pattern) => pattern === patternFrame.pattern);
        }
        return false;
      });
      parent.setState({
        patternFrames: filteredPatternFrames,
      });
    }
  }

  onSearchResult(data: string[][]) {
    console.log('onSearchResult', data);
    console.log('searchString', this.state.patternFilter);
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    if (!data[0].every((val, index) => val === parent.state?.filteredPatterns?.[index])) {
      parent.setState({
        filteredPatterns: data[0],
      });
    }
  }

  onEmptySearch() {
    const parent = sceneGraph.getAncestor(this, PatternsBreakdownScene);
    parent.setState({
      filteredPatterns: [],
    });
  }

  private getVariable() {
    const variable = sceneGraph.lookupVariable(PATTERNS_TEXT_FILTER, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Logs format variable not found');
    }
    return variable;
  }

  private updateVariable(search: string) {
    const variable = this.getVariable();
    variable.changeValueTo(`|= \`${search}\``);
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_logs_changed,
      {
        searchQueryLength: search.length,
        containsLevel: search.toLowerCase().includes('level'),
      }
    );
  }
}

const styles = {
  input: css({}),
};

export function PatternTextSearchComponent({ model }: SceneComponentProps<PatternsViewTextSearch>) {
  const { patternFilter } = model.useState();

  // Get state from parent
  const parent = sceneGraph.getAncestor(model, PatternsBreakdownScene);
  const { patternFrames } = parent.useState();
  console.log('search', patternFilter);

  // If search filter
  if (model.state.patternFilter && patternFrames) {
    debouncedFuzzySearch(
      patternFrames.map((frame) => frame.pattern),
      model.state.patternFilter,
      model.onSearchResult.bind(model)
    );
  } else if (parent.state.filteredPatterns?.length) {
    model.onEmptySearch();
  }

  return (
    <div data-testid={testIds.patterns.searchWrapper}>
      <Input className={styles.input} onChange={model.handleChange} placeholder={'Search patterns'} />
    </div>
  );
}
