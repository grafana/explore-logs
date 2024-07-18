import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, dateTime, FieldType, GrafanaTheme2 } from '@grafana/data';
import {
  CustomVariable,
  SceneComponentProps,
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
import { LokiPattern, ServiceScene } from '../../ServiceScene';
import { IndexScene } from '../../../IndexScene/IndexScene';
import { PatternsFrameScene } from './PatternsFrameScene';
import { PatternsViewTextSearch } from './PatternsViewTextSearch';
import { PatternsNotDetected, PatternsTooOld } from './PatternsNotDetected';

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

const PATTERNS_MAX_AGE_HOURS = 3;

export class PatternsBreakdownScene extends SceneObjectBase<PatternsBreakdownSceneState> {
  constructor(state: Partial<PatternsBreakdownSceneState>) {
    super({
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      patternFilter: '',
      loading: true,
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  // parent render
  public static Component = ({ model }: SceneComponentProps<PatternsBreakdownScene>) => {
    const { body, loading, blockingMessage } = model.useState();
    const { value: timeRange } = sceneGraph.getTimeRange(model).useState();
    const logsByServiceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { patterns } = logsByServiceScene.useState();
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

    // If the patterns exist already, update the dataframe
    if (serviceScene.state.patterns) {
      this.updatePatternFrames(serviceScene.state.patterns);
    }

    // Subscribe to changes from pattern API call
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if (JSON.stringify(newState.patterns) !== JSON.stringify(prevState.patterns)) {
          this.updatePatternFrames(newState.patterns);
        }
      })
    );
  }

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

  private updatePatternFrames(lokiPatterns?: LokiPattern[]) {
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

  private buildPatterns(patterns: LokiPattern[]): PatternFrame[] {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const appliedPatterns = sceneGraph.getAncestor(serviceScene, IndexScene).state.patterns;

    let maxValue = -Infinity;
    let minValue = 0;

    return patterns
      .map((pat) => {
        const timeValues: number[] = [];
        const sampleValues: number[] = [];
        let sum = 0;
        pat.samples.forEach(([time, value]) => {
          timeValues.push(time * 1000);
          const sample = parseFloat(value);
          sampleValues.push(sample);
          if (sample > maxValue) {
            maxValue = sample;
          }
          if (sample < minValue) {
            minValue = sample;
          }
          sum += sample;
        });
        const dataFrame: DataFrame = {
          refId: pat.pattern,
          fields: [
            {
              name: 'time',
              type: FieldType.time,
              values: timeValues,
              config: {},
            },
            {
              name: pat.pattern,
              type: FieldType.number,
              values: sampleValues,
              config: {},
            },
          ],
          length: pat.samples.length,
          meta: {
            preferredVisualisationType: 'graph',
          },
        };
        const existingPattern = appliedPatterns?.find((appliedPattern) => appliedPattern.pattern === pat.pattern);

        return {
          dataFrame,
          pattern: pat.pattern,
          sum,
          status: existingPattern?.type,
        };
      })
      .sort((a, b) => b.sum - a.sum);
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
