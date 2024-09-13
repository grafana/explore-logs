import { css } from '@emotion/css';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field } from '@grafana/ui';
import { debounce, escapeRegExp } from 'lodash';
import React, { ChangeEvent } from 'react';
import { testIds } from 'services/testIds';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { SearchInput } from './Breakdowns/SearchInput';
import { LineFilterIcon } from './LineFilterIcon';
import { getLineFilterVariable } from '../../services/variableGetters';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
  caseSensitive: boolean;
}

export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    super({
      lineFilter: state?.lineFilter || '',
      caseSensitive: false,
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

  updateFilter(lineFilter: string) {
    this.setState({
      lineFilter,
    });
    this.updateVariable(lineFilter);
  }

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.updateFilter(e.target.value);
  };

  onCaseSensitiveToggle = (newState: 'sensitive' | 'insensitive') => {
    this.setState({
      caseSensitive: newState === 'sensitive',
    });

    this.updateFilter(this.state.lineFilter);
  };

  updateVariable = debounce((search: string) => {
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
  }, 350);
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
          model.updateFilter('');
        }}
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
