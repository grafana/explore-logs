import React, { useEffect } from 'react';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
  SceneRefreshPicker,
} from '@grafana/scenes';
import { ButtonGroup, ToolbarButton, Tooltip } from '@grafana/ui';
import { LogExploration } from '../../pages/Explore/LogExploration';

export interface LiveTailControlState extends SceneObjectState {
  liveStreaming?: boolean;
}

export class LiveTailControl extends SceneObjectBase<LiveTailControlState> {
  static Component = LiveTailControlRenderer;
}

function LiveTailControlRenderer({ model }: SceneComponentProps<LiveTailControl>) {
  const { liveStreaming } = model.useState();
  const logExploration = sceneGraph.getAncestor(model, LogExploration);
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
