import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { getLineFiltersVariable } from '../../services/variableGetters';
import { LineFilterCaseSensitive, LineFilterEditor, LineFilterEditorProps } from '../ServiceScene/LineFilterScene';
import { LineFilterOp } from '../../services/filterTypes';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { AdHocFilterWithLabels } from '../../services/scenes';
import { debounce } from 'lodash';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { IconButton, useStyles2 } from '@grafana/ui';

interface LineFilterRendererState extends SceneObjectState {}

export class LineFilterVariablesScene extends SceneObjectBase<LineFilterRendererState> {
  constructor(state: Partial<LineFilterRendererState>) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<LineFilterVariablesScene>) => {
    const lineFilterVar = getLineFiltersVariable(model);
    const { filters } = lineFilterVar.useState();
    const styles = useStyles2(getStyles);
    filters.sort((a, b) => parseInt(a.keyLabel ?? '0', 10) - parseInt(b.keyLabel ?? '0', 10));

    if (!filters.length) {
      return null;
    }

    return (
      <div className={styles.lineFiltersWrap}>
        {filters.map((f, index) => {
          const props: LineFilterEditorProps = {
            lineFilter: f.value,
            regex: f.operator === LineFilterOp.regex || f.operator === LineFilterOp.negativeRegex,
            caseSensitive: f.key === LineFilterCaseSensitive.caseSensitive,
            exclusive: model.isFilterExclusive(f),
            handleEnter: (e, lineFilter) => model.handleEnter(e, f.value, f),
            onToggleExclusive: () => model.onToggleExclusive(f),
            updateFilter: (lineFilter, debounced) =>
              model.updateFilter(
                f,
                {
                  ...f,
                  value: lineFilter,
                },
                debounced
              ),
            onRegexToggle: () => model.onRegexToggle(f),
            onInputChange: (e) => model.onInputChange(e, f),
            onCaseSensitiveToggle: () => model.onCaseSensitiveToggle(f),
          };
          return (
            <span key={f.keyLabel} className={styles.wrapper}>
              <div className={styles.titleWrap}>
                <span>Line filter</span>
                <IconButton
                  onClick={() => model.removeFilter(f)}
                  name={'times'}
                  size={'xs'}
                  aria-label={'Line filter variable'}
                />{' '}
              </div>
              <LineFilterEditor {...props} />
            </span>
          );
        })}
      </div>
    );
  };

  onActivate() {}

  updateVariableLineFilter = (
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
      }
    );
  };

  updateVariableDebounced = debounce(
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

  handleEnter = (e: KeyboardEvent<HTMLInputElement>, lineFilter: string, filter: AdHocFilterWithLabels) => {
    if (e.key === 'Enter') {
      this.updateVariableLineFilter(filter, { ...filter, value: lineFilter });
    }
  };

  isFilterExclusive(f: AdHocFilterWithLabels): boolean {
    return f.operator === LineFilterOp.negativeMatch || f.operator === LineFilterOp.negativeRegex;
  }

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

  onInputChange = (e: ChangeEvent<HTMLInputElement>, filter: AdHocFilterWithLabels) => {
    this.updateFilter(filter, { ...filter, value: e.target.value }, true);
  };

  /**
   * Remove a filter, will trigger query
   */
  removeFilter = (filter: AdHocFilterWithLabels) => {
    const variable = getLineFiltersVariable(this);
    const otherFilters = variable.state.filters.filter(
      (f) => f.keyLabel !== undefined && f.keyLabel !== filter.keyLabel
    );

    variable.setState({
      filters: otherFilters,
    });
  };

  onCaseSensitiveToggle = (filter: AdHocFilterWithLabels) => {
    const caseSensitive =
      filter.key === LineFilterCaseSensitive.caseSensitive
        ? LineFilterCaseSensitive.caseInsensitive
        : LineFilterCaseSensitive.caseSensitive;
    this.updateFilter(filter, { ...filter, key: caseSensitive }, false);
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    lineFiltersWrap: css({
      label: 'lineFiltersWrap',
      display: 'flex',
      flexWrap: 'wrap',
      gap: `${theme.spacing(0.25)} ${theme.spacing(2)}`,
    }),
    wrapper: css({
      maxWidth: '300px',
    }),
    titleWrap: css({
      display: 'flex',
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: theme.spacing(0.5),
      gap: theme.spacing(1),
    }),
  };
}