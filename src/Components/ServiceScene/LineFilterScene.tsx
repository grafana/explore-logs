import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field } from '@grafana/ui';
import { debounce, escapeRegExp } from 'lodash';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { testIds } from 'services/testIds';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { SearchInput } from './Breakdowns/SearchInput';
import { LineFilterIcon } from './LineFilterIcon';
import { getLineFilterVariable } from '../../services/variableGetters';
import { getLineFilterCase, setLineFilterCase } from '../../services/store';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
  caseSensitive: boolean;
  regex: boolean;
}

export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    super({
      lineFilter: state?.lineFilter || '',
      caseSensitive: getLineFilterCase(false),
      regex: false,
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
    const matches = caseSensitive ? lineFilterString.match(/\|=.`(.+?)`/) : lineFilterString.match(/`\(\?i\)(.+)`/);

    if (!matches || matches.length !== 2) {
      return;
    }
    this.setState({
      lineFilter: matches[1].replace(/\\(.)/g, '$1'),
      caseSensitive,
    });
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

    this.updateFilter(this.state.lineFilter);
  };

  updateVariableDebounced = debounce((search: string) => {
    this.updateVariable(search);
  }, 1000);

  updateVariable = (search: string) => {
    const variable = getLineFilterVariable(this);
    if (search === '') {
      variable.changeValueTo('');
    } else {
      if (this.state.caseSensitive) {
        variable.changeValueTo(`|= \`${escapeRegExp(search)}\``);
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
  const { lineFilter, caseSensitive } = model.useState();
  return (
    <Field className={styles.field}>
      <SearchInput
        data-testid={testIds.exploreServiceDetails.searchLogs}
        value={lineFilter}
        className={styles.input}
        onChange={model.handleChange}
        suffix={<LineFilterIcon caseSensitive={caseSensitive} onCaseSensitiveToggle={model.onCaseSensitiveToggle} />}
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
