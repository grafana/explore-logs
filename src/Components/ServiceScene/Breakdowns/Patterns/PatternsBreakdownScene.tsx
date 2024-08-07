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
import { getPatternsFrames, ServiceScene } from '../../ServiceScene';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternsViewTextSearch } from './PatternsViewTextSearch';
import { PatternsNotDetected, PatternsTooOld } from './PatternsNotDetected';
import { areArraysEqual } from '../../../../services/comparison';
import { Unsubscribable } from 'rxjs';

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
  dataSub?: Unsubscribable;
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
    const { body, loading, blockingMessage } = model.useState();
    const { value: timeRange } = sceneGraph.getTimeRange(model).useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { $data } = logsByServiceScene.useState();
    const patterns = getPatternsFrames($data?.state.data);
    const styles = useStyles2(getStyles);
    const timeRangeTooOld = dateTime().diff(timeRange.to, 'hours') >= PATTERNS_MAX_AGE_HOURS;

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          {!loading && !patterns && (
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

          {!loading && patterns?.length === 0 && timeRangeTooOld && <PatternsTooOld />}
          {!loading && patterns?.length === 0 && !timeRangeTooOld && <PatternsNotDetected />}
          {!loading && patterns && patterns.length > 0 && (
            <div className={styles.content}>{body && <body.Component model={body} />}</div>
          )}
        </StatusWrapper>
      </div>
    );
  };

  private onActivate() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this.setBody();

    const patterns = getPatternsFrames(serviceScene.state.$data?.state.data);

    // If the patterns exist already, update the dataframe
    if (patterns) {
      this.updatePatternFrames(patterns);
    }

    // Subscribe to changes from pattern API call
    const dataSub = serviceScene.state.$data.subscribeToState(this.onDataProviderChange);
    this.setState({
      dataSub,
    });
    this._subs.add(dataSub);

    // Subscribe to changes to the query provider
    serviceScene.subscribeToState((newState, prevState) => {
      if (newState.$data.state.key !== prevState.$data.state.key) {
        const dataSub = serviceScene.state.$data.subscribeToState(this.onDataProviderChange);
        this.state.dataSub?.unsubscribe();
        this.setState({
          dataSub,
          loading: true,
        });
      }
    });
  }

  private onDataProviderChange = (newState: SceneDataState, prevState: SceneDataState) => {
    const newFrame = getPatternsFrames(newState.data);
    const prevFrame = getPatternsFrames(prevState.data);
    if (!areArraysEqual(newFrame, prevFrame) || this.state.loading) {
      this.updatePatternFrames(newFrame);
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

  private updatePatternFrames(lokiPatterns?: DataFrame[]) {
    if (!lokiPatterns) {
      console.warn('failed to update pattern frames');
      return;
    }

    const patternFrames = this.buildPatterns(lokiPatterns);

    this.setState({
      patternFrames,
      loading: false,
    });
  }

  private buildPatterns(patterns: DataFrame[]): PatternFrame[] {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const appliedPatterns = sceneGraph.getAncestor(serviceScene, IndexScene).state.patterns;

    return patterns.map((dataFrame) => {
      const existingPattern = appliedPatterns?.find((appliedPattern) => appliedPattern.pattern === dataFrame.name);

      const sum: number = dataFrame.meta?.custom?.sum;
      const patternFrame: PatternFrame = {
        dataFrame,
        pattern: dataFrame.name as string,
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

export function buildPatternsScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new PatternsBreakdownScene({}),
      }),
    ],
  });
}
