import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { InlineField, InlineSwitch } from '@grafana/ui';
import React, { ChangeEvent } from 'react';
import { getLogOption, setLogOption } from 'services/store';
import { LogsListScene } from './LogsListScene';

interface LogOptionsState extends SceneObjectState {
  wrapLines?: boolean;
}

export class LogOptionsScene extends SceneObjectBase<LogOptionsState> {
  static Component = LogOptionsRenderer;

  constructor(state?: Partial<LogOptionsState>) {
    super({
      ...state,
      wrapLines: Boolean(getLogOption('wrapLines')),
    });
  }

  handleWrapLinesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    this.setState({ wrapLines: checked });
    setLogOption('wrapLines', checked);
    const parentScene = sceneGraph.getAncestor(this, LogsListScene);
    if (parentScene) {
      parentScene.updateLogsPanel();
    }
  };
}

function LogOptionsRenderer({ model }: SceneComponentProps<LogOptionsScene>) {
  const { wrapLines } = model.useState();

  return (
    <InlineField label="Wrap lines" transparent htmlFor="wrap-lines-switch">
      <InlineSwitch
        value={wrapLines}
        onChange={model.handleWrapLinesChange}
        className={styles.horizontalInlineSwitch}
        transparent
        id="wrap-lines-switch"
      />
    </InlineField>
  );
}

const styles = {
  input: css({
    width: '100%',
  }),
  field: css({
    label: 'field',
    marginBottom: 0,
  }),
  horizontalInlineSwitch: css({
    padding: `0 4px 0 0`,
  }),
};
