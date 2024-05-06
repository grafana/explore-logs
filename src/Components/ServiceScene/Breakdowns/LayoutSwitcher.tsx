import React from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { reportAppInteraction } from 'services/analytics';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
  // used for analytics
  viewName: 'labels' | 'fields' | 'logs' | 'patterns';
}

export type LayoutType = 'single' | 'grid' | 'rows';

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public Selector({ model }: { model: LayoutSwitcher }) {
    const { active, options } = model.useState();

    return (
      <Field label="View">
        <RadioButtonGroup options={options} value={active} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (active: LayoutType) => {
    reportAppInteraction('service_selection', 'layout_changed', {
      layout: active,
      view: this.state.viewName,
    });
    this.setState({ active });
  };

  public static Component = ({ model }: SceneComponentProps<LayoutSwitcher>) => {
    const { layouts, options, active } = model.useState();

    const index = options.findIndex((o) => o.value === active);
    if (index === -1) {
      return null;
    }

    const layout = layouts[index];

    return <layout.Component model={layout} />;
  };
}
