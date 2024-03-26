import React from 'react';

import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { ButtonGroup, ToolbarButton, Tooltip } from '@grafana/ui';

export interface LiveTailControlState extends SceneObjectState {
  liveStreaming?: boolean;
}

export class LiveTailControl extends SceneObjectBase<LiveTailControlState> {
  static Component = LiveTailControlRenderer;
}

function LiveTailControlRenderer({ model }: SceneComponentProps<LiveTailControl>) {
  const { liveStreaming } = model.useState();

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
        >
          Live
        </ToolbarButton>
      </Tooltip>
    </ButtonGroup>
  );
}
