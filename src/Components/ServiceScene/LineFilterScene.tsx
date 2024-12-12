import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field } from '@grafana/ui';
import { debounce, escape, escapeRegExp } from 'lodash';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { testIds } from 'services/testIds';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { SearchInput } from './Breakdowns/SearchInput';
import { LineFilterIcon } from './LineFilterIcon';
import { getLineFilterVariable } from '../../services/variableGetters';
import { getLineFilterCase, getLineFilterRegex, setLineFilterCase, setLineFilterRegex } from '../../services/store';
import { RegexIcon, RegexInputValue } from './RegexIcon';
import { logger } from '../../services/logger';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
}

export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    const caseSensitive = getLineFilterCase(false);
    super({
      lineFilter: state?.lineFilter || '',
      caseSensitive,
      regex: getLineFilterRegex(false),
      ...state,
    });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const lineFilterValue = getLineFilterVariable(this).getValue();
    const lineFilterString = lineFilterValue.toString();
    if (!lineFilterValue) {
      return;
    }
    const caseSensitive = lineFilterString.includes('|=');

    const caseSensitiveMatches = caseSensitive
      ? lineFilterString.match(/\|=.`(.+?)`/)
      : lineFilterString.match(/`\(\?i\)(.+)`/);
    const regexMatches = lineFilterString.match(/\|~.+\`(.*?)\`/);

    // If the existing query is case sensitive, overwrite the users options for case sensitivity
    if (caseSensitiveMatches && caseSensitiveMatches.length === 2) {
      // If the current state is not regex, remove escape chars
      if (!this.state.regex) {
        this.setState({
          lineFilter: caseSensitiveMatches[1].replace(/\\(.)/g, '$1'),
          caseSensitive,
        });
        return;
      } else {
        // If regex, don't remove escape chars
        this.setState({
          lineFilter: caseSensitiveMatches[1],
          caseSensitive,
        });
      }
      return;
    }

    if (regexMatches?.length === 2) {
      this.setState({
        lineFilter: regexMatches[1],
      });

      return;
    } else {
      const error = new Error(`Unable to parse line filter: ${lineFilterString}`);
      logger.error(error, { msg: `Unable to parse line filter: ${lineFilterString}` });
      throw error;
    }
  };

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

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.updateFilter(e.target.value);
  };

  handleEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.updateVariable(this.state.lineFilter);
    }
  };

  onCaseSensitiveToggle = (newState: 'sensitive' | 'insensitive') => {
    const caseSensitive = newState === 'sensitive';

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
      variable.changeValueTo('');
    } else {
      if (this.state.caseSensitive && !this.state.regex) {
        variable.changeValueTo(`|= \`${escapeRegExp(search)}\``);
      } else if (this.state.caseSensitive && this.state.regex) {
        variable.changeValueTo(`|~ \`${escape(search)}\``);
      } else if (!this.state.caseSensitive && this.state.regex) {
        variable.changeValueTo(`|~ \`(?i)${escape(search)}\``);
      } else {
        variable.changeValueTo(`|~ \`(?i)${escapeRegExp(search)}\``);
      }
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
  const { lineFilter, caseSensitive, regex } = model.useState();
  return (
    <Field className={styles.field}>
      <SearchInput
        data-testid={testIds.exploreServiceDetails.searchLogs}
        value={lineFilter}
        className={styles.input}
        onChange={model.handleChange}
        suffix={
          <>
            <LineFilterIcon caseSensitive={caseSensitive} onCaseSensitiveToggle={model.onCaseSensitiveToggle} />
            <RegexIcon regex={regex} onRegexToggle={model.onRegexToggle} />
          </>
        }
        placeholder="Search in log lines"
        onClear={() => {
          model.updateFilter('', false);
        }}
        onKeyUp={model.handleEnter}
      />
    </Field>
  );
}

const styles = {
  input: css({
    width: '100%',
  }),
  field: css({
    label: 'field',
    width: '100%',
    marginBottom: 0,
  }),
};
