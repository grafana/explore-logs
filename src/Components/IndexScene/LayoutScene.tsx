import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { IndexScene } from './IndexScene';
import { css } from '@emotion/css';
import { InterceptBanner } from './InterceptBanner';

import { PLUGIN_ID } from '../../services/plugin';
import { logger } from '../../services/logger';
import { LineFilterVariablesScene } from './LineFilterVariablesScene';
import { VariableLayoutScene } from './VariableLayoutScene';

interface LayoutSceneState extends SceneObjectState {
  interceptDismissed: boolean;
  lineFilterRenderer?: LineFilterVariablesScene;
  variableLayout?: SceneObject;
}

const interceptBannerStorageKey = `${PLUGIN_ID}.interceptBannerStorageKey`;

export const CONTROLS_VARS_FIRST_ROW_KEY = 'vars-row__datasource-labels-timepicker-button';
export const CONTROLS_VARS_METADATA_ROW_KEY = 'vars-metadata';
export const CONTROLS_VARS_LEVELS_ROW_KEY = 'vars-levels';
export const CONTROLS_VARS_FIELDS = 'vars-fields';
export const CONTROLS_VARS_FIELDS_COMBINED = 'vars-fields-metadata';
export const CONTROLS_VARS_TIMEPICKER = 'vars-timepicker';
export const CONTROLS_VARS_REFRESH = 'vars-refresh';
export const CONTROLS_VARS_TOOLBAR = 'vars-toolbar';
export const CONTROLS_VARS_DATASOURCE = 'vars-ds';
export const CONTROLS_VARS_LABELS = 'vars-labels';

export class LayoutScene extends SceneObjectBase<LayoutSceneState> {
  constructor(state: Partial<LayoutSceneState>) {
    super({
      ...state,
      interceptDismissed: !!localStorage.getItem(interceptBannerStorageKey),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<LayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { contentScene } = indexScene.useState();
    const { interceptDismissed, variableLayout } = model.useState();

    if (!contentScene) {
      logger.warn('content scene not defined');
      return null;
    }

    const styles = useStyles2(getStyles);
    return (
      <div className={styles.bodyContainer}>
        <div className={styles.container}>
          {!interceptDismissed && (
            <InterceptBanner
              onRemove={() => {
                model.dismiss();
              }}
            />
          )}

          {variableLayout && <variableLayout.Component model={variableLayout} />}

          {/* Final "row" - body */}
          <div className={styles.body}>{contentScene && <contentScene.Component model={contentScene} />}</div>
        </div>
      </div>
    );
  };

  public onActivate() {
    this.setState({
      lineFilterRenderer: new LineFilterVariablesScene({}),
      variableLayout: new VariableLayoutScene({}),
    });
  }

  public dismiss() {
    this.setState({
      interceptDismissed: true,
    });
    localStorage.setItem(interceptBannerStorageKey, 'true');
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    bodyContainer: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
      padding: theme.spacing(2),
      maxWidth: '100vw',
    }),
    body: css({
      label: 'body-wrapper',
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    controlsContainer: css({
      label: 'controlsContainer',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
  };
}
