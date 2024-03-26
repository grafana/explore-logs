import React from 'react';

import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button } from '@grafana/ui';
import { LogExploration } from '../../../../pages/Explore';

export interface AddToPatternsGraphActionState extends SceneObjectState {
  pattern: string;
  type: 'exclude' | 'include';
}

export class AddToPatternsGraphAction extends SceneObjectBase<AddToPatternsGraphActionState> {
  public onClick = () => {
    const logExploration = sceneGraph.getAncestor(this, LogExploration);

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

  public static Component = ({ model }: SceneComponentProps<AddToPatternsGraphAction>) => {
    const { type } = model.useState();
    return (
      <Button variant="primary" size="sm" fill="text" onClick={model.onClick}>
        {type === 'include' ? 'Add to search' : 'Exclude from search'}
      </Button>
    );
  };
}
