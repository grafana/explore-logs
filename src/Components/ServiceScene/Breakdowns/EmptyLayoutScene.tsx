import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { GrotError } from '../../GrotError';
import { Alert } from '@grafana/ui';
import React from 'react';
import { emptyStateStyles } from './FieldsBreakdownScene';

export interface EmptyLayoutSceneState extends SceneObjectState {
  type: 'fields' | 'labels';
}

export class EmptyLayoutScene extends SceneObjectBase<EmptyLayoutSceneState> {
  public static Component({ model }: SceneComponentProps<EmptyLayoutScene>) {
    const { type } = model.useState();
    return (
      <GrotError>
        <Alert title="" severity="warning">
          We did not find any {type} for the given timerange. Please{' '}
          <a
            className={emptyStateStyles.link}
            href="https://forms.gle/1sYWCTPvD72T1dPH9"
            target="_blank"
            rel="noopener noreferrer"
          >
            let us know
          </a>{' '}
          if you think this is a mistake.
        </Alert>
      </GrotError>
    );
  }
}
