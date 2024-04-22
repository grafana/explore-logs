import { SceneObject, sceneGraph } from '@grafana/scenes';
import { LiveTailButton } from 'Components/Forms/LiveTailButton';
import { IndexScene } from 'Components/Index/IndexScene';

export function getLiveTailControl(model: SceneObject): LiveTailButton | undefined {
  return sceneGraph
    .getAncestor(model, IndexScene)
    ?.state.controls.find((c) => c instanceof LiveTailButton) as LiveTailButton;
}
