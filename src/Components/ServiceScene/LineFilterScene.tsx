import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Field, IconButton } from '@grafana/ui';
import { debounce, escape, escapeRegExp } from 'lodash';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { testIds } from 'services/testIds';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { SearchInput } from './Breakdowns/SearchInput';
import { LineFilterIconButton } from './LineFilterIconButton';
import { getLineFiltersVariable, getLineFilterVariable } from '../../services/variableGetters';
import {
  getLineFilterCase,
  getLineFilterExclusive,
  getLineFilterRegex,
  setLineFilterCase,
  setLineFilterExclusive,
  setLineFilterRegex,
} from '../../services/store';
import { RegexIconButton, RegexInputValue } from './RegexIconButton';
import { LineFilterOp } from '../../services/filterTypes';
import { locationService } from '@grafana/runtime';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
  exclusive: boolean;
}

export enum LineFilterCaseSensitive {
  caseSensitive = 'caseSensitive',
  caseInsensitive = 'caseInsensitive',
}

/**
 * TODO:
 * * UI needs love
 * * * This component
 * * * Build custom renderer for ad hoc variables
 * * Duplicate queries
 * * Testing
 * * Nothing is escaped right now
 * * Discuss serializing case sensitivity option
 * *
 */
export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    super({
      lineFilter: state?.lineFilter || '',
      caseSensitive: state?.caseSensitive ?? getLineFilterCase(false),
      regex: state?.regex ?? getLineFilterRegex(false),
      exclusive: state?.exclusive ?? getLineFilterExclusive(false),
      ...state,
    });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    this.migrateOldVariable();
    const filter = this.getFilter();

    if (!filter) {
      return;
    }

    this.setState({
      lineFilter: filter.value,
      regex: filter.operator === LineFilterOp.regex || filter.operator === LineFilterOp.negativeRegex,
      caseSensitive: filter.key === LineFilterCaseSensitive.caseSensitive,
      exclusive: filter.operator === LineFilterOp.negativeMatch || filter.operator === LineFilterOp.negativeRegex,
    });
  };

  private migrateOldVariable() {
    const search = locationService.getSearch();

    const deprecatedLineFilter = search.get('var-lineFilter');

    if (!deprecatedLineFilter) {
      return;
    }

    const newVariable = getLineFilterVariable(this);
    const caseSensitiveMatches = deprecatedLineFilter?.match(/\|=.`(.+?)`/);

    if (caseSensitiveMatches && caseSensitiveMatches.length === 2) {
      this.setState({
        caseSensitive: true,
        exclusive: false,
        regex: false,
        lineFilter: caseSensitiveMatches[1],
      });
    }
    const caseInsensitiveMatches = deprecatedLineFilter?.match(/`\(\?i\)(.+)`/);
    if (caseInsensitiveMatches && caseInsensitiveMatches.length === 2) {
      this.setState({
        caseSensitive: false,
        regex: false,
        exclusive: false,
        lineFilter: caseInsensitiveMatches[1],
      });
    }

    newVariable.setState({
      filters: [
        {
          key: this.getFilterKey(),
          operator: this.getOperator(),
          value: this.state.lineFilter,
        },
      ],
    });

    // Remove from url without refreshing
    const newLocation = locationService.getLocation();
    search.delete('var-lineFilter');
    newLocation.search = search.toString();
    locationService.replace(newLocation.pathname + '?' + newLocation.search);
    this.updateFilter(this.state.lineFilter, false);
  }

  updateFilter(lineFilter: string, debounced = true) {
    this.setState({
      lineFilter,
    });
    if (debounced) {
      this.updateVariableDebounced(lineFilter);
    } else {
      this.updateVariable(lineFilter);
    }
  }

  onToggleExclusive = () => {
    setLineFilterExclusive(!this.state.exclusive);
    this.setState({
      exclusive: !this.state.exclusive,
    });

    this.updateFilter(this.state.lineFilter, false);
  };

  getOperator(): LineFilterOp {
    if (this.state.regex && this.state.exclusive) {
      return LineFilterOp.negativeRegex;
    }
    if (this.state.regex && !this.state.exclusive) {
      return LineFilterOp.regex;
    }
    if (!this.state.regex && this.state.exclusive) {
      return LineFilterOp.negativeMatch;
    }
    if (!this.state.regex && !this.state.exclusive) {
      return LineFilterOp.match;
    }

    throw new Error('getOperator: failed to determine operation');
  }

  getFilterKey() {
    return this.state.caseSensitive ? LineFilterCaseSensitive.caseSensitive : LineFilterCaseSensitive.caseInsensitive;
  }
  getFilterValue() {
    const filter = this.getFilter();
    return filter.value;
  }

  getFilter() {
    const lineFilterVariable = getLineFilterVariable(this);
    return lineFilterVariable.state.filters[0];
  }

  onSubmitLineFilter = () => {
    // @todo this causes the logs panel query to run twice even though the interpolated expr will not change as we're just moving the filter from one variable to another.
    // We either need to manually execute the logPanelQuery, find a way to only run queries when the interpolated output changes, or maybe there should be a flag on setState to keep a particular change from causing data providers to re-query?
    const lineFiltersVariable = getLineFiltersVariable(this);
    const existingFilters = lineFiltersVariable.state.filters;

    lineFiltersVariable.setState({
      filters: [...existingFilters, this.getFilter()],
    });
    this.clearVariable();
  };

  private clearVariable() {
    const variable = getLineFilterVariable(this);
    variable.setState({
      filters: [],
    });
    this.setState({
      lineFilter: '',
    });
  }

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.updateFilter(e.target.value);
  };

  handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.updateVariable(this.state.lineFilter);
    }
  };

  onCaseSensitiveToggle = (newState: LineFilterCaseSensitive) => {
    const caseSensitive = newState === LineFilterCaseSensitive.caseSensitive;

    // Set value to scene state
    this.setState({
      caseSensitive,
    });

    // Set value in local storage
    setLineFilterCase(caseSensitive);

    this.updateFilter(this.state.lineFilter, false);
  };

  onRegexToggle = (newState: RegexInputValue) => {
    const regex = newState === 'regex';

    // Set value to scene state
    this.setState({
      regex,
    });

    // Set value in local storage
    setLineFilterRegex(regex);

    this.updateFilter(this.state.lineFilter, false);
  };

  updateVariableDebounced = debounce((search: string) => {
    this.updateVariable(search);
  }, 1000);

  updateVariable = (search: string) => {
    const variable = getLineFilterVariable(this);
    if (search === '') {
      variable.setState({
        filters: [],
      });
    } else {
      variable.setState({
        filters: [
          {
            key: this.getFilterKey(),
            operator: this.getOperator(),
            value: search,
          },
        ],
      });
    }

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.search_string_in_logs_changed,
      {
        searchQueryLength: search.length,
        containsLevel: search.toLowerCase().includes('level'),
      }
    );
  };
}

function LineFilterRenderer({ model }: SceneComponentProps<LineFilterScene>) {
  const { lineFilter, caseSensitive, regex, exclusive } = model.useState();
  return (
    <div className={styles.wrapper}>
      {/* @todo these icons are not great, ! and = would be better? Ask Joan */}
      <IconButton
        className={styles.exclusiveBtn}
        tooltip={exclusive ? 'Exclude matching lines' : 'Include matching lines'}
        onClick={model.onToggleExclusive}
        size={'xl'}
        name={exclusive ? 'minus' : 'plus'}
        aria-label={'Exclude'}
      />
      <Field className={styles.field}>
        <SearchInput
          data-testid={testIds.exploreServiceDetails.searchLogs}
          value={lineFilter}
          className={styles.input}
          onChange={model.handleChange}
          suffix={
            <>
              <LineFilterIconButton caseSensitive={caseSensitive} onCaseSensitiveToggle={model.onCaseSensitiveToggle} />
              <RegexIconButton regex={regex} onRegexToggle={model.onRegexToggle} />
            </>
          }
          placeholder="Search in log lines"
          onClear={() => {
            model.updateFilter('', false);
          }}
          onKeyUp={model.handleEnter}
        />
      </Field>
      <Button
        onClick={model.onSubmitLineFilter}
        className={styles.submit}
        variant={'primary'}
        fill={'outline'}
        disabled={!lineFilter}
      >
        Submit
      </Button>
    </div>
  );
}

const styles = {
  wrapper: css({
    display: 'flex',
    width: '100%',
  }),
  submit: css({
    marginLeft: '1rem',
  }),
  input: css({
    width: '100%',
  }),
  exclusiveBtn: css({
    marginRight: '1rem',
  }),
  field: css({
    label: 'field',
    width: '100%',
    marginBottom: 0,
  }),
};
