import { css } from '@emotion/css';
import { CustomVariable, SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Field } from '@grafana/ui';
import { debounce, escapeRegExp } from 'lodash';
import React, { ChangeEvent } from 'react';
import { VAR_LINE_FILTER } from 'services/variables';
import { testIds } from 'services/testIds';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { SearchInput } from './Breakdowns/SearchInput';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
}

export class LineFilterScene extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    super({ lineFilter: state?.lineFilter || '', ...state });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const lineFilterValue = this.getVariable().getValue();
    if (!lineFilterValue) {
      return;
    }
    const matches = lineFilterValue.toString().match(/`\(\?i\)(.+)`/);
    if (!matches || matches.length !== 2) {
      return;
    }
    this.setState({
      lineFilter: matches[1].replace(/\\(.)/g, '$1'),
    });
  };

  private getVariable() {
    const variable = sceneGraph.lookupVariable(VAR_LINE_FILTER, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Logs format variable not found');
    }
    return variable;
  }

  updateFilter(lineFilter: string) {
    this.setState({
      lineFilter,
    });
    this.updateVariable(lineFilter);
  }

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.updateFilter(e.target.value);
  };

  updateVariable = debounce((search: string) => {
    const variable = this.getVariable();
    variable.changeValueTo(`|~ \`(?i)${escapeRegExp(search)}\``);
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
  const { lineFilter } = model.useState();

  return (
    <Field className={styles.field}>
      <SearchInput
        data-testid={testIds.exploreServiceDetails.searchLogs}
        value={lineFilter}
        className={styles.input}
        onChange={model.handleChange}
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
