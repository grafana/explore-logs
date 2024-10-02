import { map, Observable, of } from 'rxjs';
import {
  MultiValueVariable,
  MultiValueVariableState,
  renderSelectForVariable,
  SceneComponentProps,
  ValidateAndUpdateResult,
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

  //@todo audit
  public validateAndUpdate(): Observable<ValidateAndUpdateResult> {
    // If we didn't define any options, don't validate when we try to change the value
    if (this.state.options.length) {
      return super.validateAndUpdate();
    }

    return this.getValueOptions({}).pipe(
      map((options) => {
        return {};
      })
    );
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    return of(this.state.options);
  }

  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return renderSelectForVariable(model);
  };
}
