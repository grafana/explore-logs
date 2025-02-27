import { AdHocFilterWithLabels, SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { getLineFiltersVariable } from '../../services/variableGetters';
import { LineFilterCaseSensitive, LineFilterOp } from '../../services/filterTypes';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { debounce } from 'lodash';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { useStyles2 } from '@grafana/ui';
import { LineFilterProps, LineFilterVariable } from './LineFilterVariable';
import { addCurrentUrlToHistory } from '../../services/navigate';

interface LineFilterRendererState extends SceneObjectState {}

/**
 * The scene for the submitted line filter that is rendered up top with the other variables.
 * @todo refactor into new directory with other custom variable renderers and/or layout scenes
 */
export class LineFilterVariablesScene extends SceneObjectBase<LineFilterRendererState> {
  static Component = ({ model }: SceneComponentProps<LineFilterVariablesScene>) => {
    const lineFilterVar = getLineFiltersVariable(model);
    const { filters } = lineFilterVar.useState();
    const styles = useStyles2(getStyles);
    sortLineFilters(filters);

    if (!filters.length) {
      return null;
    }

    return (
      <div className={styles.lineFiltersWrap}>
        {filters.map((filter) => {
          const props: LineFilterProps = {
            lineFilter: filter.value,
            regex: filter.operator === LineFilterOp.regex || filter.operator === LineFilterOp.negativeRegex,
            caseSensitive: filter.key === LineFilterCaseSensitive.caseSensitive,
            exclusive: model.isFilterExclusive(filter),
            handleEnter: (e, lineFilter) => model.handleEnter(e, filter.value, filter),
            setExclusive: () => model.onToggleExclusive(filter),
            updateFilter: (lineFilter, debounced) =>
              model.updateFilter(
                filter,
                {
                  ...filter,
                  value: lineFilter,
                },
                debounced
              ),
            onRegexToggle: () => model.onRegexToggle(filter),
            onInputChange: (e) => model.onInputChange(e, filter),
            onCaseSensitiveToggle: () => model.onCaseSensitiveToggle(filter),
          };
          return <LineFilterVariable key={filter.keyLabel} onClick={() => model.removeFilter(filter)} props={props} />;
        })}
      </div>
    );
  };
  /**
   * Submit on enter
   */
  handleEnter = (e: KeyboardEvent<HTMLInputElement>, lineFilter: string, filter: AdHocFilterWithLabels) => {
    if (e.key === 'Enter') {
      // Add the current url to browser history before the state is changed so the user can revert their change.
      addCurrentUrlToHistory();
      this.updateVariableLineFilter(filter, { ...filter, value: lineFilter });
    }
  };

  isFilterExclusive({ operator }: AdHocFilterWithLabels): boolean {
    return operator === LineFilterOp.negativeMatch || operator === LineFilterOp.negativeRegex;
  }

  /**
   * Updates filter operator when user toggles regex
   */
  onRegexToggle = (filter: AdHocFilterWithLabels) => {
    let newOperator: LineFilterOp;
    // Set value to scene state
    switch (filter.operator) {
      case LineFilterOp.match: {
        newOperator = LineFilterOp.regex;
        break;
      }
      case LineFilterOp.negativeMatch: {
        newOperator = LineFilterOp.negativeRegex;
        break;
      }
      case LineFilterOp.regex: {
        newOperator = LineFilterOp.match;
        break;
      }
      case LineFilterOp.negativeRegex: {
        newOperator = LineFilterOp.negativeMatch;
        break;
      }
      default: {
        throw new Error('Invalid operator!');
      }
    }

    this.updateFilter(filter, { ...filter, operator: newOperator }, false);
  };

  /**
   * Updates filter operator when user toggles exclusion
   */
  onToggleExclusive = (filter: AdHocFilterWithLabels) => {
    let newOperator: string;
    switch (filter.operator) {
      case LineFilterOp.match: {
        newOperator = LineFilterOp.negativeMatch;
        break;
      }
      case LineFilterOp.negativeMatch: {
        newOperator = LineFilterOp.match;
        break;
      }
      case LineFilterOp.regex: {
        newOperator = LineFilterOp.negativeRegex;
        break;
      }
      case LineFilterOp.negativeRegex: {
        newOperator = LineFilterOp.regex;
        break;
      }
      default: {
        throw new Error('Invalid operator!');
      }
    }

    this.updateFilter(filter, { ...filter, operator: newOperator }, false);
  };

  /**
   * Updates filter key when user toggles case sensitivity
   */
  onCaseSensitiveToggle = (filter: AdHocFilterWithLabels) => {
    const caseSensitive =
      filter.key === LineFilterCaseSensitive.caseSensitive
        ? LineFilterCaseSensitive.caseInsensitive
        : LineFilterCaseSensitive.caseSensitive;
    this.updateFilter(filter, { ...filter, key: caseSensitive }, false);
  };

  /**
   * Updates existing line filter ad-hoc variable filter
   */
  updateFilter(existingFilter: AdHocFilterWithLabels, filterUpdate: AdHocFilterWithLabels, debounced = true) {
    if (debounced) {
      // We want to update the UI right away, which uses the filter state as the UI state, but we don't want to execute the query immediately
      this.updateVariableLineFilter(existingFilter, filterUpdate, true);
      // Run the debounce to force the event emit, as the prior setState will have already set the filterExpression, which will otherwise prevent the emit of the event which will trigger the query
      this.updateVariableDebounced(existingFilter, filterUpdate, false, true);
    } else {
      this.updateVariableLineFilter(existingFilter, filterUpdate);
    }
  }

  /**
   * Line filter input onChange helper method
   */
  onInputChange = (e: ChangeEvent<HTMLInputElement>, filter: AdHocFilterWithLabels) => {
    this.updateFilter(filter, { ...filter, value: e.target.value }, true);
  };

  /**
   * Remove a filter, will trigger query
   */
  removeFilter = (filter: AdHocFilterWithLabels) => {
    addCurrentUrlToHistory();
    const variable = getLineFiltersVariable(this);
    const otherFilters = variable.state.filters.filter(
      (f) => f.keyLabel !== undefined && f.keyLabel !== filter.keyLabel
    );

    variable.setState({
      filters: otherFilters,
    });
  };

  /**
   * Update existing line filter ad-hoc variable
   */
  private updateVariableLineFilter = (
    existingFilter: AdHocFilterWithLabels,
    filterUpdate: AdHocFilterWithLabels,
    skipPublish = false,
    forcePublish = false
  ) => {
    const variable = getLineFiltersVariable(this);
    const otherFilters = variable.state.filters.filter(
      (f) => f.keyLabel !== undefined && f.keyLabel !== existingFilter.keyLabel
    );

    variable.updateFilters(
      [
        {
          keyLabel: existingFilter.keyLabel,
          key: filterUpdate.key,
          operator: filterUpdate.operator,
          value: filterUpdate.value,
        },
        ...otherFilters,
      ],
      { skipPublish, forcePublish }
    );

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_variables_changed,
      {
        searchQueryLength: existingFilter.value.length,
        containsLevel: existingFilter.value.toLowerCase().includes('level'),
        operator: filterUpdate.operator,
        caseSensitive: filterUpdate.key,
      }
    );
  };

  /**
   * Debounce line-filter ad-hoc variable update
   */
  private updateVariableDebounced = debounce(
    (
      existingFilter: AdHocFilterWithLabels,
      filterUpdate: AdHocFilterWithLabels,
      skipPublish = false,
      forcePublish = false
    ) => {
      this.updateVariableLineFilter(existingFilter, filterUpdate, skipPublish, forcePublish);
    },
    1000
  );
}

/**
 * Sort line filters by keyLabel, i.e. the order the line filter was added
 */
export function sortLineFilters(filters: AdHocFilterWithLabels[]) {
  filters.sort((a, b) => parseInt(a.keyLabel ?? '0', 10) - parseInt(b.keyLabel ?? '0', 10));
}

function getStyles(theme: GrafanaTheme2) {
  return {
    lineFiltersWrap: css({
      label: 'lineFiltersWrap',
      display: 'flex',
      flexWrap: 'wrap',
      gap: `${theme.spacing(0.25)} ${theme.spacing(2)}`,
    }),
  };
}
