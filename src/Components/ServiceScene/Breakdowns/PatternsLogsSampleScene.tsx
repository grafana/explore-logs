import { PanelBuilders, SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React from 'react';
import { css } from '@emotion/css';
import { getQueryRunner } from '../../../services/panel';
import { buildLokiQuery } from '../../../services/query';
import { LOG_STREAM_SELECTOR_EXPR } from '../../../services/variables';

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
    // @todo why does this scene have no parents?
    console.log('this.parent', this.parent); // undefined
    console.log('this.parent.parent', this.parent?.parent); // undefined
    if (!this.state.body) {
      const query = buildLokiQuery(LOG_STREAM_SELECTOR_EXPR);
      console.log('query', query);
      console.log('expr', query.expr);

      this.setState({
        $variables: this.state.$variables,
        body: PanelBuilders.logs()
          .setVariables(this.state.$variables)
          .setTitle(this.state.pattern)
          .setOption('showLogContextToggle', true)
          .setOption('showTime', true)
          .setData(getQueryRunner(query))
          .build(),
      });
    }
  }

  public static Component({ model }: SceneComponentProps<PatternsLogsSampleScene>) {
    const { body } = model.useState();
    return (
      <>
        <div className={styles.bodyWrap}>{body && <body.Component model={body} />}</div>
      </>
    );
  }
}

const styles = {
  bodyWrap: css({
    '> div': {
      height: '200px',
    },
  }),
};
