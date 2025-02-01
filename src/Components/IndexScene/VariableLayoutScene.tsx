import { SceneComponentProps, SceneFlexLayout, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { css, cx } from '@emotion/css';
import { GiveFeedbackButton } from './GiveFeedbackButton';
import { CustomVariableValueSelectors } from './CustomVariableValueSelectors';
import { PatternControls } from './PatternControls';
import { AppliedPattern, IndexScene } from './IndexScene';
import {
  CONTROLS_VARS_DATASOURCE,
  CONTROLS_VARS_FIELDS_COMBINED,
  CONTROLS_VARS_LEVELS_ROW_KEY,
  LayoutScene,
} from './LayoutScene';
import { useStyles2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';

interface VariableLayoutSceneState extends SceneObjectState {}
export class VariableLayoutScene extends SceneObjectBase<VariableLayoutSceneState> {
  static Component = ({ model }: SceneComponentProps<VariableLayoutScene>) => {
    const indexScene = sceneGraph.getAncestor(model, IndexScene);
    const { controls, patterns } = indexScene.useState();

    const layoutScene = sceneGraph.getAncestor(model, LayoutScene);
    const { lineFilterRenderer } = layoutScene.useState();

    const styles = useStyles2(getStyles);

    return (
      <div className={styles.controlsContainer}>
        <>
          {/* First row - datasource, timepicker, refresh, labels, button */}
          {controls && (
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
                <div className={styles.timeRangeDatasource}>
                  {controls.map((control) => {
                    return control.state.key === CONTROLS_VARS_DATASOURCE ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}

                  <div className={styles.timeRange}>
                    {controls.map((control) => {
                      return !(control instanceof CustomVariableValueSelectors) &&
                        !(control instanceof SceneFlexLayout) ? (
                        <control.Component key={control.state.key} model={control} />
                      ) : null;
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Second row - Levels */}
          <div className={styles.controlsRowContainer}>
            {controls &&
              controls.map((control) => {
                return control instanceof CustomVariableValueSelectors &&
                  control.state.key === CONTROLS_VARS_LEVELS_ROW_KEY ? (
                  <div key={control.state.key} className={styles.filtersWrap}>
                    <div className={cx(styles.filters, styles.levelsWrap)}>
                      <control.Component model={control} />
                    </div>
                  </div>
                ) : null;
              })}
          </div>

          {/* 3rd row - Fields Combined  */}
          <div className={styles.controlsRowContainer}>
            {controls && (
              <div className={styles.filtersWrap}>
                <div className={styles.filters}>
                  {controls.map((control) => {
                    return control instanceof CustomVariableValueSelectors &&
                      control.state.key === CONTROLS_VARS_FIELDS_COMBINED ? (
                      <control.Component key={control.state.key} model={control} />
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4th row - Patterns */}
          <div className={styles.controlsRowContainer}>
            <PatternControls
              patterns={patterns}
              onRemove={(patterns: AppliedPattern[]) => indexScene.setState({ patterns })}
            />
          </div>

          {/* 5th row - line filters */}
          <div className={styles.controlsRowContainer}>
            {lineFilterRenderer && <lineFilterRenderer.Component model={lineFilterRenderer} />}
          </div>
        </>
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
      label: 'controls-first-row',
      display: 'flex',
      gap: theme.spacing(2),
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }),
    controlsRowContainer: css({
      '&:empty': {
        display: 'none',
      },
      label: 'controls-row',
      display: 'flex',
      // @todo add custom renderers for all variables, this currently results in 2 "empty" rows that always take up space
      gap: theme.spacing(1),
      // justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingLeft: theme.spacing(2),
    }),
    controlsContainer: css({
      label: 'controlsContainer',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    filters: css({
      label: 'filters',
      display: 'flex',
    }),
    filtersWrap: css({
      label: 'filtersWrap',
      display: 'flex',
      gap: theme.spacing(2),
      width: 'calc(100% - 450)',
      flexWrap: 'wrap',
      alignItems: 'flex-end',
    }),
    levelsWrap: css({
      // @todo add a way to hideLabel, hideAddButton, hideOperator in core Scenes to avoid hacks like this
      label: 'levels-wrap',
      '& > div > div': {
        overflow: 'hidden',
        // Hide variable field name label
        '& label': {
          display: 'none',
        },
        // Hide add more button
        '& button': {
          display: 'none',
        },
        // Hide operator
        '& > div > div > div > div > div:first-child': {
          display: 'none',
        },
        // Fix styles
        '& > div > div > div > div > div:last-child': {
          marginLeft: 0,
          '& > div > div > div': {
            paddingRight: '8px',
          },
        },
      },
    }),
    controlsWrapper: css({
      label: 'controlsWrapper',
      display: 'flex',
      flexDirection: 'column',
      marginTop: theme.spacing(0.375),
    }),
    timeRangeDatasource: css({
      label: 'timeRangeDatasource',
      display: 'flex',
      gap: theme.spacing(1),
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    }),
    timeRange: css({
      label: 'timeRange',
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(1),
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
