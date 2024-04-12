import { SceneCSSGridItem, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { ALL_VARIABLE_VALUE } from '../../../../utils/shared';
import { LoadingState, SelectableValue } from '@grafana/data';

export interface GenericBreakdownSceneState extends SceneObjectState {
  labels: Array<SelectableValue<string>>;
  changeLabels?: (n: string[]) => void;
}

export class GenericBreakdownScene<
  TState extends SceneObjectState = SceneObjectState
> extends SceneObjectBase<GenericBreakdownSceneState> {
  protected removeErrorsAndSingleCardinality(queryRunner: SceneQueryRunner, gridItem: SceneCSSGridItem) {
    queryRunner.getResultsStream().subscribe((result) => {
      if (result.data.errors && result.data.errors.length > 0) {
        const val = result.data.errors[0].refId!;
        this.hideField(val);
        gridItem.setState({ isHidden: true });
      } else if (result.data.state === LoadingState.Done) {
        // Hide panels with single cardinality
        if (result.data.series.length < 2) {
          const val = result.data.series?.[0]?.refId;
          gridItem.setState({ isHidden: true });

          if (val) {
            this.hideField(val);
          }
        }
      }
    });
  }

  protected hideField(field: string) {
    const labels = this.state.labels.filter((f) => f.value !== field);
    this.setState({ labels });

    this.state.changeLabels?.(labels.filter((f) => f.value !== ALL_VARIABLE_VALUE).map((f) => f.value!));
  }
}
