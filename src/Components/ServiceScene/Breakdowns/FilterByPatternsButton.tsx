import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { IndexScene } from '../../IndexScene/IndexScene';
import { reportAppInteraction } from 'services/analytics';

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
    const filteredPatterns = patterns.filter((pattern) => pattern.pattern !== this.state.pattern);

    // Analytics
    const includePatternsLength = filteredPatterns.filter((p) => p.type === 'include')?.length ?? 0;
    const excludePatternsLength = filteredPatterns.filter((p) => p.type === 'exclude')?.length ?? 0;
    reportAppInteraction('service_selection', 'patterns_filtered', {
      type: this.state.type,
      includePatternsLength: includePatternsLength + (this.state.type === 'include' ? 1 : 0),
      excludePatternsLength: excludePatternsLength + (this.state.type === 'exclude' ? 1 : 0),
    });

    logExploration.setState({
      patterns: [...filteredPatterns, { pattern: this.state.pattern, type: this.state.type }],
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
