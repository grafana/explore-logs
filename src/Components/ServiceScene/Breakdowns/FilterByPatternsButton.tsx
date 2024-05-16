import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { IndexScene } from '../../IndexScene/IndexScene';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';

export interface FilterByPatternsButtonState extends SceneObjectState {
  pattern: string;
  type: 'exclude' | 'include';
}

export class FilterByPatternsButton extends SceneObjectBase<FilterByPatternsButtonState> {
  public onClick = () => {
    const logExploration = sceneGraph.getAncestor(this, IndexScene);

    if (!logExploration) {
      return;
    }

    const { patterns = [] } = logExploration.state;

    // Remove the pattern if it's already there
    let filteredPatterns = patterns.filter((pattern) => pattern.pattern !== this.state.pattern);

    if (this.state.type === 'include') {
      // Patterns are mutually exclusive, if one is included, we should remove the rest
      filteredPatterns = [{ pattern: this.state.pattern, type: this.state.type }];
    } else {
      // If a pattern is excluded, remove any existing included patterns
      filteredPatterns = [
        ...filteredPatterns.filter((pat) => pat.type === 'exclude'),
        { pattern: this.state.pattern, type: this.state.type },
      ];
    }

    // Analytics
    const includePatternsLength = filteredPatterns.filter((p) => p.type === 'include')?.length ?? 0;
    const excludePatternsLength = filteredPatterns.filter((p) => p.type === 'exclude')?.length ?? 0;
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.pattern_selected, {
      type: this.state.type,
      includePatternsLength: includePatternsLength + (this.state.type === 'include' ? 1 : 0),
      excludePatternsLength: excludePatternsLength + (this.state.type === 'exclude' ? 1 : 0),
    });

    logExploration.setState({
      patterns: filteredPatterns,
    });
  };

  public static Component = ({ model }: SceneComponentProps<FilterByPatternsButton>) => {
    const { type } = model.useState();
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick}>
        {type === 'include' ? 'Add to filters' : 'Exclude from filters'}
      </Button>
    );
  };
}
