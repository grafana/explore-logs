import {
  PanelBuilders,
  SceneComponentProps,
  SceneDataProviderResult,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  VizPanel,
} from '@grafana/scenes';
import React from 'react';
import { getQueryRunner } from '../../../services/panel';
import { buildLokiQuery, LokiQuery, renderPatternFilters } from '../../../services/query';
import {
  LOG_STREAM_SELECTOR_EXPR,
  PATTERNS_SAMPLE_SELECTOR_EXPR,
  VAR_PATTERNS_EXPR,
} from '../../../services/variables';
import { AppliedPattern } from '../../IndexScene/IndexScene';
import { LoadingState } from '@grafana/data';
import { Alert } from '@grafana/ui';
import { PatternsViewTableScene } from './Patterns/PatternsViewTableScene';

interface PatternsLogsSampleSceneState extends SceneObjectState {
  pattern: string;
  body?: SceneFlexLayout;
}
export class PatternsLogsSampleScene extends SceneObjectBase<PatternsLogsSampleSceneState> {
  constructor(state: PatternsLogsSampleSceneState) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    if (!this.state.body) {
      // We start by querying with the users current query context
      const queryWithFilters = buildLokiQuery(LOG_STREAM_SELECTOR_EXPR);
      this.replacePatternsInQueryWithThisPattern(queryWithFilters);

      // but if that fails to return results, we fire the query without the filters, instead of showing no-data in the viz
      const queryRunnerWithFilters = getQueryRunner(queryWithFilters);
      queryRunnerWithFilters.getResultsStream().subscribe(this.onQueryWithFiltersResult);

      this.setState({
        body: new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              body: undefined,
              width: '100%',
              height: 0,
            }),
            new SceneFlexItem({
              height: 300,
              width: '100%',
              body: PanelBuilders.logs()
                .setHoverHeader(true)
                .setOption('showLogContextToggle', true)
                .setOption('showTime', true)
                .setData(queryRunnerWithFilters)
                .build(),
            }),
          ],
        }),
      });
    }
  }

  private replacePatternsInQueryWithThisPattern(queryWithFilters: LokiQuery) {
    const pendingPattern: AppliedPattern = {
      pattern: this.state.pattern,
      type: 'include',
    };
    const patternsLine = renderPatternFilters([pendingPattern]);
    queryWithFilters.expr = queryWithFilters.expr.replace(VAR_PATTERNS_EXPR, patternsLine);
  }

  /**
   * If the first query with the users filters applied fails, we run another one after removing the filters
   * @param value
   */
  private onQueryWithoutFiltersResult = (value: SceneDataProviderResult) => {
    if (
      value.data.state === LoadingState.Done &&
      (value.data.series.length === 0 || value.data.series.every((frame) => frame.length === 0))
    ) {
      // Logging an error so loki folks can debug why some patterns returned from the API seem to fail.
      console.error('Pattern query returns no results', {
        pattern: this.state.pattern,
        traceIds: value.data.traceIds,
        request: value.data.request,
      });

      const children = this.state.body?.state.children;
      const noticeFlexItem = children?.[0];
      const panelFlexItem = children?.[1];

      if (noticeFlexItem instanceof SceneFlexItem) {
        noticeFlexItem.setState({
          height: 'auto',
          body: new SceneReactObject({
            reactNode: (
              <Alert severity={'error'} title={''}>
                This pattern returns no logs.
              </Alert>
            ),
          }),
        });
      }

      // Run another query without the filters so we can still show log lines of what the pattern looks like.
      if (panelFlexItem instanceof SceneFlexItem) {
        panelFlexItem.setState({
          isHidden: true,
        });
      }
    }
  };

  /**
   * Callback to subscription of pattern sample query with all of the current query filters applied.
   * If this query fails to return data, we show a warning, and attempt the pattern sample query again without applying the existing filters.
   * We also add the pattern to the state of the PatternsTableViewScene so we can hide the filter buttons for this pattern, as including it would break the query
   * @param value
   */
  private onQueryWithFiltersResult = (value: SceneDataProviderResult) => {
    const queryWithoutFilters = buildLokiQuery(PATTERNS_SAMPLE_SELECTOR_EXPR);
    this.replacePatternsInQueryWithThisPattern(queryWithoutFilters);

    const queryRunner = getQueryRunner(queryWithoutFilters);

    // Subscribe to the secondary query, so we can log errors and update the UI
    queryRunner.getResultsStream().subscribe(this.onQueryWithoutFiltersResult);

    if (
      value.data.state === LoadingState.Done &&
      (value.data.series.length === 0 || value.data.series.every((frame) => frame.length === 0))
    ) {
      const children = this.state.body?.state.children;
      const noticeFlexItem = children?.[0];
      const panelFlexItem = children?.[1];

      // Add a warning notice that the patterns shown will not show up in their current log results due to their existing filters.
      if (noticeFlexItem instanceof SceneFlexItem) {
        noticeFlexItem.setState({
          height: 'auto',
          body: new SceneReactObject({
            reactNode: (
              <Alert severity={'warning'} title={''}>
                The logs returned by this pattern do not match your active query filters. To filter by this pattern,
                first clear your filters.
              </Alert>
            ),
          }),
        });
      }

      // Run another query without the filters so we can still show log lines of what the pattern looks like.
      if (panelFlexItem instanceof SceneFlexItem) {
        const panel = panelFlexItem.state.body;
        if (panel instanceof VizPanel) {
          panel?.setState({
            $data: queryRunner,
          });
        }
      }

      const patternsViewTableScene = sceneGraph.getAncestor(this, PatternsViewTableScene);
      const patternsThatDontMatchCurrentFilters =
        patternsViewTableScene.state.patternsThatDontMatchCurrentFilters ?? [];

      // Add this pattern to the array of patterns that don't match current filters
      patternsViewTableScene.setState({
        patternsThatDontMatchCurrentFilters: [...patternsThatDontMatchCurrentFilters, this.state.pattern],
      });
    }
  };

  public static Component({ model }: SceneComponentProps<PatternsLogsSampleScene>) {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }
    return null;
  }
}
