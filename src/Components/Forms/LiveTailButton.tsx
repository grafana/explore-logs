import React, { useEffect } from 'react';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { ButtonGroup, ToolbarButton, Tooltip } from '@grafana/ui';
import { IndexScene } from 'Components/Index/IndexScene';

export interface LiveTailButtonState extends SceneObjectState {
  liveStreaming?: boolean;
}

export class LiveTailButton extends SceneObjectBase<LiveTailButtonState> {
  static Component = LiveTailControlRenderer;
}

function LiveTailControlRenderer({ model }: SceneComponentProps<LiveTailButton>) {
  const { liveStreaming } = model.useState();
  const logExploration = sceneGraph.getAncestor(model, IndexScene);
  const { controls } = logExploration.useState();
  const refreshPicker = controls.find((c) => c instanceof SceneRefreshPicker) as SceneRefreshPicker;
  const refresh = refreshPicker?.useState().refresh || '';

  useEffect(() => {
    // If the refresh interval is set, disable live streaming
    if (refresh !== '' && liveStreaming) {
      model.setState({ liveStreaming: !liveStreaming });
    }
  }, [model, refresh, liveStreaming]);

  return (
    <ButtonGroup>
      <Tooltip
        content={liveStreaming ? <>Stop and exit the live stream</> : <>Start live stream your logs</>}
        placement="bottom"
      >
        <ToolbarButton
          variant={liveStreaming ? 'active' : 'default'}
          icon={liveStreaming ? 'square-shape' : 'play'}
          onClick={() => model.setState({ liveStreaming: !liveStreaming })}
          disabled={refresh !== '' ? true : false}
        >
          Live
        </ToolbarButton>
      </Tooltip>
    </ButtonGroup>
  );
}
