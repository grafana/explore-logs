import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VariableValueSelectors } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { PatternControls } from './PatternControls';
import { AppliedPattern, IndexSceneState } from './IndexScene';
import { css } from '@emotion/css';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { InterceptBanner } from './InterceptBanner';
import { PLUGIN_ID } from '../../services/routing';

interface LayoutSceneState extends SceneObjectState {
  interceptDismissed: boolean;
}

const interceptBannerStorageKey = `${PLUGIN_ID}.interceptBannerStorageKey`;

export class LayoutScene extends SceneObjectBase<LayoutSceneState> {
  constructor(state: Partial<LayoutSceneState>) {
    super({
      ...state,
      interceptDismissed: !!localStorage.getItem(interceptBannerStorageKey),
    });
  }

  public dismiss() {
    this.setState({
      interceptDismissed: true,
    });
    localStorage.setItem(interceptBannerStorageKey, 'true');
  }

  static Component = ({ model }: SceneComponentProps<LayoutScene>) => {
    if (!model.parent) {
      return null;
    }

    const { controls, contentScene, patterns } = model.parent.useState() as IndexSceneState;
    const { interceptDismissed } = model.useState();
    if (!contentScene) {
      return null;
    }

    const styles = useStyles2(getStyles);
    return (
      <div className={styles.bodyContainer}>
        {!interceptDismissed && (
          <InterceptBanner
            onRemove={() => {
              model.dismiss();
            }}
          />
        )}
        <div className={styles.container}>
          {controls && (
            <div className={styles.controlsContainer}>
              <div className={styles.filters}>
                {controls.map((control) =>
                  control instanceof VariableValueSelectors ? (
                    <control.Component key={control.state.key} model={control} />
                  ) : null
                )}
              </div>
              <div className={styles.controlsWrapper}>
                <GiveFeedbackButton />
                <div className={styles.controls}>
                  {controls.map((control) =>
                    control instanceof VariableValueSelectors === false ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null
                  )}
                </div>
              </div>
            </div>
          )}
          <PatternControls
            patterns={patterns}
            onRemove={(patterns: AppliedPattern[]) => model.parent?.setState({ patterns } as IndexSceneState)}
          />
          <div className={styles.body}>{contentScene && <contentScene.Component model={contentScene} />}</div>
        </div>
      </div>
    );
  };
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
      gap: theme.spacing(1),
      minHeight: '100%',
      flexDirection: 'column',
      padding: theme.spacing(2),
      maxWidth: '100vw',
    }),
    body: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    controlsContainer: css({
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }),
    filters: css({
      display: 'flex',
      gap: theme.spacing(2),
      width: 'calc(100% - 450)',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
      '& + div[data-testid="data-testid Dashboard template variables submenu Label Filters"]:empty': {
        visibility: 'hidden',
      },

      //@todo not like this
      // The filter variables container: i.e. services, filters
      '&:first-child': {
        // The wrapper of each filter
        '& > div': {
          // The actual inputs container
          '& > div': {
            flexWrap: 'wrap',
            // wrapper around all inputs
            '& > div': {
              maxWidth: '380px',

              // Wrapper around each input: i.e. label name, binary operator, value
              '& > div': {
                // These inputs need to flex, otherwise the value takes all of available space and they look broken
                flex: '1 0 auto',

                // The value input needs to shrink when the parent component is at max width
                '&:nth-child(3)': {
                  flex: '0 1 auto',
                },
              },
            },
          },
        },
      },
      // the `service_name` filter is a special case where we want to hide the operator
      '[data-testid="AdHocFilter-service_name"]': {
        'div[class*="input-wrapper"]:first-child': {
          display: 'none',
        },
        'div[class*="input-wrapper"]:nth-child(2)': {
          marginLeft: 0,
        },
      },

      ['div >[title="Add filter"]']: {
        border: 0,
        display: 'none',
        width: 0,
        padding: 0,
        margin: 0,
      },
    }),
    controlsWrapper: css({
      display: 'flex',
      flexDirection: 'column',
    }),
    controls: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    feedback: css({
      textAlign: 'end',
    }),
    rotateIcon: css({
      svg: { transform: 'rotate(180deg)' },
    }),
  };
}
