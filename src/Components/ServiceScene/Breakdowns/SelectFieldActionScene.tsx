import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ServiceScene } from '../ServiceScene';
import { navigateToValueBreakdown } from '../../../services/navigate';
import { ValueSlugs } from '../../../services/routing';
import { Button } from '@grafana/ui';
import React from 'react';

interface SelectFieldActionSceneState extends SceneObjectState {
  labelName: string;
}

// @todo DRY this and SelectLabelAction
export class SelectFieldActionScene extends SceneObjectBase<SelectFieldActionSceneState> {
  public onClick = () => {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    console.log('nav to value breakdown', this.state.labelName);
    navigateToValueBreakdown(ValueSlugs.field, this.state.labelName, serviceScene);
  };

  public static Component = ({ model }: SceneComponentProps<SelectFieldActionScene>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Select
      </Button>
    );
  };
}
