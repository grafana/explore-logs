import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { GrotError } from '../../GrotError';
import { Alert, Button } from '@grafana/ui';
import React from 'react';
import { emptyStateStyles } from './FieldsBreakdownScene';

export interface ClearFiltersLayoutSceneState extends SceneObjectState {
  clearCallback: () => void;
}
export class NoMatchingLabelsScene extends SceneObjectBase<ClearFiltersLayoutSceneState> {
  public static Component = ({ model }: SceneComponentProps<NoMatchingLabelsScene>) => {
    const { clearCallback } = model.useState();
    return (
      <GrotError>
        <Alert title="" severity="info">
          No labels match these filters.{' '}
          <Button className={emptyStateStyles.button} onClick={() => clearCallback()}>
            Clear filters
          </Button>{' '}
        </Alert>
      </GrotError>
    );
  };
}
