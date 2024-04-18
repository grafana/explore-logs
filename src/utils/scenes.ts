import { SceneObject, sceneGraph } from '@grafana/scenes';
import { LiveTailControl } from 'components/misc/LiveTailControl';
import { MainComponent } from 'components/Main/MainComponent';

export function getLiveTailControl(model: SceneObject): LiveTailControl | undefined {
  return sceneGraph
    .getAncestor(model, MainComponent)
    ?.state.controls.find((c) => c instanceof LiveTailControl) as LiveTailControl;
}
