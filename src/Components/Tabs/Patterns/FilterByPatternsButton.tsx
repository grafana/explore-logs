import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { IndexScene } from 'Components/Index/IndexScene';

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

    // remove from the other list if it's there
    if (logExploration.state.patterns?.find((p) => p.pattern === this.state.pattern)) {
      logExploration.setState({
        patterns: logExploration.state.patterns.filter((pattern) => pattern.pattern !== this.state.pattern),
      });
    }

    logExploration.setState({
      patterns: [...(logExploration.state.patterns || []), { pattern: this.state.pattern, type: this.state.type }],
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
