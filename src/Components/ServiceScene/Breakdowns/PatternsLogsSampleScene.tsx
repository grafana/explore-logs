import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import React from 'react';
import { getQueryRunner } from '../../../services/panel';
import { buildLokiQuery, renderPatternFilters } from '../../../services/query';
import { LOG_STREAM_SELECTOR_EXPR, VAR_PATTERNS_EXPR } from '../../../services/variables';
import { AppliedPattern } from '../../IndexScene/IndexScene';

interface PatternsLogsSampleSceneState extends SceneObjectState {
  pattern: string;
  body?: SceneObject;
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
      // We can query with the entire query context, but that will mean that some panels return no data, even though we're returning a pattern, because the patterns only take indexed labels
      // @todo do we want to return no-data because the user already has filters applied that will make this pattern not helpful for the current query?
      // Or do we want to show a sample of the pattern that shows up in the table, even though the user could have already filtered that out with line filters or detected fields?
      // const query = buildLokiQuery(LOG_STREAM_SELECTOR_EXPR);

      // Currently preventing no-data when the user has active line-filters or detected fields in the query by only adding the interpolated indexed labels to the query!
      const query = buildLokiQuery(LOG_STREAM_SELECTOR_EXPR);
      const pendingPattern: AppliedPattern = {
        pattern: this.state.pattern,
        type: 'include',
      };

      const patternsLine = renderPatternFilters([pendingPattern]);
      query.expr = query.expr.replace(VAR_PATTERNS_EXPR, patternsLine);

      this.setState({
        body: new SceneFlexLayout({
          height: 300,
          children: [
            new SceneFlexItem({
              width: '100%',
              body: PanelBuilders.logs()
                .setDescription(
                  'Sample of this pattern with all active filters applied. If this panel returns no results then the active filters have already excluded logs matching this pattern for the current time range.'
                )
                .setOption('showLogContextToggle', true)
                .setOption('showTime', true)
                .setData(getQueryRunner(query))
                .build(),
            }),
          ],
        }),
      });
    }
  }

  public static Component({ model }: SceneComponentProps<PatternsLogsSampleScene>) {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }
    return null;
  }
}
