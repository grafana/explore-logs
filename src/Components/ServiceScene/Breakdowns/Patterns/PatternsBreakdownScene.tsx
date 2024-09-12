import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, dateTime, GrafanaTheme2 } from '@grafana/data';
import {
  CustomVariable,
  SceneComponentProps,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneVariableSet,
} from '@grafana/scenes';
import { Text, useStyles2 } from '@grafana/ui';
import { StatusWrapper } from 'Components/ServiceScene/Breakdowns/StatusWrapper';
import { VAR_LABEL_GROUP_BY } from 'services/variables';
import { ServiceScene } from '../../ServiceScene';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternsViewTextSearch } from './PatternsViewTextSearch';
import { PatternsNotDetected, PatternsTooOld } from './PatternsNotDetected';
import { areArraysEqual } from '../../../../services/comparison';

export interface PatternsBreakdownSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
  value?: string;
  loading?: boolean;
  error?: string;
  blockingMessage?: string;
  // The dataframe built from the patterns that we get back from the loki Patterns API
  patternFrames?: PatternFrame[];

  // Subset of patternFrames, undefined if empty, empty array if search results returned nothing (no data)
  filteredPatterns?: PatternFrame[];
  patternFilter: string;
}

export type PatternFrame = {
  dataFrame: DataFrame;
  pattern: string;
  sum: number;
  status?: 'include' | 'exclude';
};

export const PATTERNS_MAX_AGE_HOURS = 3;

export class PatternsBreakdownScene extends SceneObjectBase<PatternsBreakdownSceneState> {
  constructor(state: Partial<PatternsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      loading: true,
      patternFilter: '',
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsBreakdownScene>) => {
    const { body, loading, blockingMessage, patternFrames } = model.useState();
    const { value: timeRange } = sceneGraph.getTimeRange(model).useState();
    const styles = useStyles2(getStyles);
    const timeRangeTooOld = dateTime().diff(timeRange.to, 'hours') >= PATTERNS_MAX_AGE_HOURS;

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          {!loading && !patternFrames && (
            <div className={styles.patternMissingText}>
              <Text textAlignment="center" color="primary">
                <p>There are no pattern matches.</p>
                <p>Pattern matching has not been configured.</p>
                <p>Patterns let you detect similar log lines and add or exclude them from your search.</p>
                <p>To see them in action, add the following to your configuration</p>
                <p>
                  <code>--pattern-ingester.enabled=true</code>
                </p>
              </Text>
            </div>
          )}

          {!loading && patternFrames?.length === 0 && timeRangeTooOld && <PatternsTooOld />}
          {!loading && patternFrames?.length === 0 && !timeRangeTooOld && <PatternsNotDetected />}
          {!loading && patternFrames && patternFrames.length > 0 && (
            <div className={styles.content}>{body && <body.Component model={body} />}</div>
          )}
        </StatusWrapper>
      </div>
    );
  };

  private onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this.setBody();

    const dataFrames = serviceScene.state.$patternsData?.state.data?.series;

    // If the patterns exist already, update the dataframe
    if (dataFrames) {
      this.updatePatternFrames(dataFrames);
    }

    // Subscribe to changes from pattern API call
    this._subs.add(serviceScene.state.$patternsData?.subscribeToState(this.onDataChange));
  }

  private onDataChange = (newState: SceneDataState, prevState: SceneDataState) => {
    const newFrames = newState.data?.series;
    const prevFrames = prevState.data?.series;
    if (!areArraysEqual(newFrames, prevFrames) || this.state.loading) {
      this.updatePatternFrames(newFrames);
    }
  };

  private setBody() {
    this.setState({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexItem({
            ySizing: 'content',
            body: new PatternsViewTextSearch(),
          }),
          new SceneFlexItem({
            body: new PatternsFrameScene(),
          }),
        ],
      }),
    });
  }

  private updatePatternFrames(dataFrames?: DataFrame[]) {
    if (!dataFrames) {
      return;
    }

    const patternFrames = this.dataFrameToPatternFrame(dataFrames);

    this.setState({
      patternFrames,
      loading: false,
    });
  }

  private dataFrameToPatternFrame(dataFrame: DataFrame[]): PatternFrame[] {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const appliedPatterns = sceneGraph.getAncestor(serviceScene, IndexScene).state.patterns;

    return dataFrame.map((dataFrame) => {
      const existingPattern = appliedPatterns?.find((appliedPattern) => appliedPattern.pattern === dataFrame.name);

      const sum: number = dataFrame.meta?.custom?.sum;
      const patternFrame: PatternFrame = {
        dataFrame,
        pattern: dataFrame.name ?? '',
        sum,
        status: existingPattern?.type,
      };

      return patternFrame;
    });
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      gap: theme.spacing(2),
    }),
    controlsRight: css({
      flexGrow: 0,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    controlsLeft: css({
      display: 'flex',
      justifyContent: 'flex-left',
      justifyItems: 'left',
      width: '100%',
      flexDirection: 'column',
    }),
    patternMissingText: css({
      padding: theme.spacing(2),
    }),
  };
}
