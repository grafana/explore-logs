import { css } from '@emotion/css';
import { CustomVariable, SceneComponentProps, SceneObjectBase, SceneObjectState, sceneGraph } from '@grafana/scenes';
import { Field, Input } from '@grafana/ui';
import { debounce } from 'lodash';
import React, { ChangeEvent } from 'react';
import { VAR_LINE_FILTER } from 'utils/shared';

interface LineFilterState extends SceneObjectState {
  lineFilter: string;
}

export class LineFilter extends SceneObjectBase<LineFilterState> {
  static Component = LineFilterRenderer;

  constructor(state?: Partial<LineFilterState>) {
    super({ lineFilter: state?.lineFilter || '', ...state });
    this.addActivationHandler(this._onActivate);
  }

  private _onActivate = () => {
    const lineFilterValue = this.getVariable().getValue();
    if (!lineFilterValue) {
      return;
    }
    const matches = lineFilterValue.toString().match(/`(.+)`/);
    if (!matches || matches.length !== 2) {
      return;
    }
    this.setState({
      lineFilter: matches[1],
    });
  };

  private getVariable() {
    const variable = sceneGraph.lookupVariable(VAR_LINE_FILTER, this);
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Logs format variable not found');
    }
    return variable;
  }

  handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    this.setState({
      lineFilter: e.target.value,
    });
    this.updateVariable(e.target.value);
  };

  updateVariable = debounce((search: string) => {
    const variable = this.getVariable();
    variable.changeValueTo(`|= \`${search}\``);
  }, 350);
}

function LineFilterRenderer({ model }: SceneComponentProps<LineFilter>) {
  const { lineFilter } = model.useState();

  return (
    <Field>
      <Input value={lineFilter} className={styles.input} onChange={model.handleChange} placeholder="Search" />
    </Field>
  );
}

const styles = {
  input: css({
    width: '100%',
  }),
};
