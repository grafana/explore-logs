import { SceneObject, sceneGraph } from '@grafana/scenes';
import { LiveTailControl } from 'components/Explore/LiveTailControl';
import { LogExploration } from 'pages/Explore';

export function getLiveTailControl(model: SceneObject): LiveTailControl | undefined {
  return sceneGraph
    .getAncestor(model, LogExploration)
    ?.state.controls.find((c) => c instanceof LiveTailControl) as LiveTailControl;
}
