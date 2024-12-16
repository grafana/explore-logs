import { AdHocFiltersVariable, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { AdHocFilterWithLabels } from './scenes';

type AdHocVariableExpressionBuilderFn = (filters: AdHocFilterWithLabels[]) => string;
function renderExpression(builder: AdHocVariableExpressionBuilderFn, filters: AdHocFilterWithLabels[] | undefined) {
  return builder(filters ?? []);
}

/**
 * Since we move filters from the line filter variables, which should never change the interpolated query, but it does change the expression built by each individual ad-hoc variable,
 * We're extending the AdHocVariable in order to skip publishing this event in setState.
 *
 * @todo remove if/when https://github.com/grafana/scenes/pull/1004 is included in core scenes
 */
export class CustomAdHocFiltersVariable extends AdHocFiltersVariable {
  public setState(update: Partial<AdHocFiltersVariable['state']>, options?: { skipPublish?: boolean }): void {
    let filterExpressionChanged = false;

    if (this.state.expressionBuilder === undefined) {
      throw new Error('CustomAdHocFiltersVariable requires expression builder is defined!');
    }

    if (update.filters && update.filters !== this.state.filters && !update.filterExpression) {
      update.filterExpression = renderExpression(this.state.expressionBuilder, update.filters);
      filterExpressionChanged = update.filterExpression !== this.state.filterExpression;
    }

    super.setState(update);

    if (filterExpressionChanged && options?.skipPublish !== true) {
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }
}
