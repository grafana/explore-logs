import { Observable, of } from 'rxjs';
import {
  MultiValueVariable,
  MultiValueVariableState,
  renderSelectForVariable,
  SceneComponentProps,
  VariableGetOptionsArgs,
  VariableValueOption,
  VariableValueSingle,
} from '@grafana/scenes';

export interface CustomConstantVariableState extends MultiValueVariableState {
  value: VariableValueSingle;
  isMulti?: false;
}

export class CustomConstantVariable extends MultiValueVariable<CustomConstantVariableState> {
  public constructor(initialState: Partial<CustomConstantVariableState>) {
    super({
      type: 'custom',
      value: '',
      text: '',
      options: [],
      name: '',
      ...initialState,
    });
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    return of(this.state.options);
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return renderSelectForVariable(model);
  };
}
