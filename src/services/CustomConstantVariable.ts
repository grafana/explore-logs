import { Observable, of } from 'rxjs';
import {
  MultiValueVariable,
  MultiValueVariableState,
  renderSelectForVariable,
  SceneComponentProps,
  VariableGetOptionsArgs,
  VariableValueOption,
} from '@grafana/scenes';

export interface CustomConstantVariableState extends MultiValueVariableState {}

// export class CustomConstantVariable extends CustomVariable {
//     protected _variableDependency = new VariableDependencyConfig(this, {
//         statePaths: ['query'],
//     });
//
//     public constructor(initialState: Partial<CustomConstantVariableState>) {
//         super({
//             ...initialState,
//         });
//     }
//
//     public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
//         console.log('args', args)
//         console.log('CustomConstantVariable.state', this.state)
//         return of(this.state.options);
//     }
//
// }
//

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
