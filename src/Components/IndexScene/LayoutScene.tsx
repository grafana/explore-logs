import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneFlexLayout, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import React from 'react';
import { PatternControls } from './PatternControls';
import { AppliedPattern, IndexScene, IndexSceneState } from './IndexScene';
import { css, cx } from '@emotion/css';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { InterceptBanner } from './InterceptBanner';

import { PLUGIN_ID } from '../../services/plugin';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import { logger } from '../../services/logger';
import { LineFilterVariablesScene } from './LineFilterVariablesScene';

interface LayoutSceneState extends SceneObjectState {
  interceptDismissed: boolean;
  lineFilterRenderer?: LineFilterVariablesScene;
}

const interceptBannerStorageKey = `${PLUGIN_ID}.interceptBannerStorageKey`;

export class LayoutScene extends SceneObjectBase<LayoutSceneState> {
  constructor(state: Partial<LayoutSceneState>) {
    super({
      ...state,
      interceptDismissed: !!localStorage.getItem(interceptBannerStorageKey),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    this.setState({
      lineFilterRenderer: new LineFilterVariablesScene({}),
    });
  }

  public dismiss() {
    this.setState({
      interceptDismissed: true,
    });
    localStorage.setItem(interceptBannerStorageKey, 'true');
  }

  static Component = ({ model }: SceneComponentProps<LayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, contentScene, patterns } = indexScene.useState();
    const { interceptDismissed, lineFilterRenderer } = model.useState();

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
          {controls && (
            <div className={styles.controlsContainer}>
              <div className={styles.controlsFirstRowContainer}>
                <div className={styles.filtersWrap}>
                  <div className={cx(styles.filters, styles.firstRowWrapper)}>
                    {controls.map((control) => {
                      return control instanceof SceneFlexLayout ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
                <div className={styles.controlsWrapper}>
                  <GiveFeedbackButton />
                  <div className={styles.controls}>
                    {controls.map((control) => {
                      return !(control instanceof CustomVariableValueSelectors) &&
                        !(control instanceof SceneFlexLayout) ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
              <div className={styles.controlsSecondRowContainer}>
                <div className={styles.filtersWrap}>
                  <div className={styles.filters}>
                    {controls.map((control) => {
                      return control instanceof CustomVariableValueSelectors ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          <PatternControls
            patterns={patterns}
            onRemove={(patterns: AppliedPattern[]) => model.parent?.setState({ patterns } as IndexSceneState)}
          />

          {lineFilterRenderer && (
            <div className={styles.lineFiltersWrap}>
              <lineFilterRenderer.Component model={lineFilterRenderer} />
            </div>
          )}
          <div className={styles.body}>{contentScene && <contentScene.Component model={contentScene} />}</div>
        </div>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    firstRowWrapper: css({
      '& > div > div': {
        gap: '16px',
        label: 'first-row-wrapper',

        [theme.breakpoints.down('lg')]: {
          flexDirection: 'column',
        },

        // The datasource variable width should be auto, not fill the section
        '& > div:first-child': {
          flex: '1 0 auto',
          display: 'inline-block',
        },
      },
    }),
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
    controlsFirstRowContainer: css({
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: theme.spacing(2),
    }),
    controlsSecondRowContainer: css({
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }),
    controlsContainer: css({
      label: 'controlsContainer',
    }),
    filters: css({
      label: 'filters',
    }),
    filtersWrap: css({
      label: 'filtersWrap',
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
      '& > div &:first-child': {
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
    lineFiltersWrap: css({
      label: 'lineFiltersWrap',
      display: 'flex',
      gap: theme.spacing(2),
    }),
    controlsWrapper: css({
      label: 'controlsWrapper',
      display: 'flex',
      flexDirection: 'column',
      marginTop: theme.spacing(0.375),
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
