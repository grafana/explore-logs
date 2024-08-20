import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';

interface SelectLabelActionSceneState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelActionScene extends SceneObjectBase<SelectLabelActionSceneState> {
  public onClick = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    navigateToValueBreakdown(ValueSlugs.label, this.state.labelName, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelActionScene>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Values
      </Button>
    );
  };
}
