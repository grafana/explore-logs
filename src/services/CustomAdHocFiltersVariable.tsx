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
  /**
   * Updates the variable's `filters` and `filterExpression` state.
   * If `skipPublish` option is true, this will not emit the `SceneVariableValueChangedEvent`,
   * allowing consumers to update the filters without triggering dependent data providers.
   */
  public updateFilters(
    filters: AdHocFilterWithLabels[],
    options?: {
      skipPublish?: boolean;
      forcePublish?: boolean;
    }
  ): void {
    let filterExpressionChanged = false;
    let filterExpression = undefined;

    if (this.state.expressionBuilder === undefined) {
      throw new Error('CustomAdHocFiltersVariable requires expression builder is defined!');
    }

    if (filters && filters !== this.state.filters) {
      filterExpression = renderExpression(this.state.expressionBuilder, filters);
      filterExpressionChanged = filterExpression !== this.state.filterExpression;
    }

    super.setState({
      filters,
      filterExpression,
    });

    if ((filterExpressionChanged && options?.skipPublish !== true) || options?.forcePublish) {
      this.publishEvent(new SceneVariableValueChangedEvent(this), true);
    }
  }
}
