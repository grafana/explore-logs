import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Button, Field, Icon, Select } from '@grafana/ui';
import { debounce } from 'lodash';
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
import { AdHocFilterWithLabels } from '../../services/scenes';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
  exclusive: boolean;
  loading: boolean;
}

export enum LineFilterCaseSensitive {
  caseSensitive = 'caseSensitive',
  caseInsensitive = 'caseInsensitive',
}

/**
 * The line filter scene used in the logs tab
 */
export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterComponent;

  constructor(state?: Partial<LineFilterState>) {
    super({
      lineFilter: state?.lineFilter || '',
      caseSensitive: state?.caseSensitive ?? getLineFilterCase(false),
      regex: state?.regex ?? getLineFilterRegex(false),
      exclusive: state?.exclusive ?? getLineFilterExclusive(false),
      loading: false,
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

    return () => {
      // This won't clear the variable as the URL won't have time to sync, but it does prevent changes to the variable that haven't yet been synced with this scene state
      this.clearFilter();
    };
  };

  private migrateOldVariable() {
    const search = locationService.getSearch();

    const deprecatedLineFilter = search.get('var-lineFilter');

    if (!deprecatedLineFilter) {
      return;
    }

    const newVariable = getLineFilterVariable(this);
    const existingVariables = getLineFiltersVariable(this);
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
          // This should always be 0, since migrated urls won't have the new values, but better safe than sorry?
          keyLabel: existingVariables.state.filters.length.toString(),
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
      this.setState({
        loading: true,
      });
      this.updateVariableDebounced(lineFilter);
    } else {
      this.updateVariable(lineFilter);
    }
  }

  clearFilter = () => {
    this.updateFilter('', false);
  };

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

  getFilter() {
    const lineFilterVariable = getLineFilterVariable(this);

    if (lineFilterVariable.state.filters.length) {
      return lineFilterVariable.state.filters[0];
    } else {
      // if the user submits before the debounce, we need to set the current state to the variable
      this.updateVariable(this.state.lineFilter);
      return lineFilterVariable.state.filters[0];
    }
  }

  /**
   * @todo need to set loading state and set disabled when loading
   */
  onSubmitLineFilter = () => {
    const lineFiltersVariable = getLineFiltersVariable(this);
    const existingFilters = lineFiltersVariable.state.filters;
    const thisFilter = this.getFilter();

    lineFiltersVariable.updateFilters({ filters: [...existingFilters, thisFilter] }, { skipPublish: true });
    this.clearVariable();
  };

  private clearVariable() {
    const variable = getLineFilterVariable(this);
    variable.updateFilters(
      { filters: [] },
      {
        skipPublish: true,
      }
    );
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
    const variables = getLineFiltersVariable(this);
    variable.setState({
      filters: [
        {
          key: this.getFilterKey(),
          keyLabel: variables.state.filters.length.toString(),
          operator: this.getOperator(),
          value: search,
        },
      ],
    });
    this.setState({
      loading: false,
    });
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

export interface LineFilterEditorProps {
  filter?: AdHocFilterWithLabels;
  exclusive: boolean;
  loading?: boolean;
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
  onToggleExclusive: () => void;
  onInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCaseSensitiveToggle: (caseSensitive: LineFilterCaseSensitive) => void;
  onRegexToggle: (regex: RegexInputValue) => void;
  updateFilter: (lineFilter: string, debounced: boolean) => void;
  handleEnter: (e: KeyboardEvent<HTMLInputElement>, lineFilter: string) => void;
  onSubmitLineFilter?: () => void;
  onRemoveLineFilter?: () => void;
  onClearLineFilter?: () => void;
}

export function LineFilterEditor({
  filter,
  exclusive,
  lineFilter,
  caseSensitive,
  onToggleExclusive,
  regex,
  onInputChange,
  onCaseSensitiveToggle,
  onRegexToggle,
  handleEnter,
  onSubmitLineFilter,
  onRemoveLineFilter,
  onClearLineFilter,
  loading,
}: LineFilterEditorProps) {
  return (
    <div className={styles.wrapper}>
      <Select
        prefix={null}
        className={styles.select}
        value={exclusive ? 'exclusive' : 'inclusive'}
        options={[
          {
            value: 'exclusive',
            label: 'Exclude',
          },
          {
            value: 'inclusive',
            label: 'Include',
          },
        ]}
        onChange={onToggleExclusive}
      />
      <Field className={styles.field}>
        <SearchInput
          inputClassName={styles.input}
          data-testid={testIds.exploreServiceDetails.searchLogs}
          value={lineFilter}
          className={styles.input}
          onChange={onInputChange}
          suffix={
            <span className={`${styles.suffix} input-suffix`}>
              <LineFilterIconButton caseSensitive={caseSensitive} onCaseSensitiveToggle={onCaseSensitiveToggle} />
              <RegexIconButton regex={regex} onRegexToggle={onRegexToggle} />
            </span>
          }
          prefix={null}
          placeholder="Search in log lines"
          onClear={onClearLineFilter}
          onKeyUp={(e) => handleEnter(e, lineFilter)}
        />
      </Field>
      {onSubmitLineFilter && (
        <>
          <Button
            onClick={onSubmitLineFilter}
            className={styles.submit}
            variant={'primary'}
            fill={'outline'}
            disabled={!lineFilter || loading}
          >
            Submit
          </Button>
          <div className={styles.submitLoading}>{loading ? <Icon name={'spinner'} /> : null}</div>
        </>
      )}

      {onRemoveLineFilter && (
        <Button
          tooltip={'Remove filter'}
          variant="secondary"
          aria-label="Remove filter"
          title="Remove filter"
          className={styles.removeBtn}
          icon="times"
          data-testid={`AdHocFilter-remove-${filter?.keyLabel ?? ''}`}
          onClick={onRemoveLineFilter}
        />
      )}
    </div>
  );
}

function LineFilterComponent({ model }: SceneComponentProps<LineFilterScene>) {
  const { lineFilter, caseSensitive, regex, exclusive, loading } = model.useState();
  return LineFilterEditor({
    loading,
    exclusive,
    lineFilter,
    caseSensitive,
    regex,
    onSubmitLineFilter: model.onSubmitLineFilter,
    handleEnter: model.handleEnter,
    onInputChange: model.handleChange,
    updateFilter: model.updateFilter,
    onCaseSensitiveToggle: model.onCaseSensitiveToggle,
    onRegexToggle: model.onRegexToggle,
    onToggleExclusive: model.onToggleExclusive,
    onClearLineFilter: model.clearFilter,
  });
}

const styles = {
  suffix: css({
    display: 'inline-flex',
  }),
  removeBtn: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  submitLoading: css({
    width: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  submit: css({
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  }),
  select: css({
    label: 'line-filter-exclusion',
    marginLeft: 0,
    paddingLeft: 0,
    height: 'auto',
    borderBottomRightRadius: '0',
    borderTopRightRadius: '0',
    borderRight: 'none',
    minHeight: '30px',
    width: '100px',
    maxWidth: '95px',
    outline: 'none',
  }),
  wrapper: css({
    display: 'flex',
    width: '100%',
    maxWidth: '600px',
  }),
  input: css({
    label: 'line-filter-input-wrapper',
    width: '100%',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,

    input: {
      borderRadius: 0,
      borderRight: 'none',
    },
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
