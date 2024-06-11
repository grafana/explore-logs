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
import { buildLokiQuery } from '../../../services/query';
import { LOG_STREAM_SELECTOR_EXPR, VAR_PATTERNS_EXPR } from '../../../services/variables';
import { AppliedPattern, renderPatternFilters } from '../../IndexScene/IndexScene';

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
                .setHoverHeader(true)
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
