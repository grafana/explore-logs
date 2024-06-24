import React from 'react';

import { SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { USER_EVENTS_ACTIONS, USER_EVENTS_PAGES, reportAppInteraction } from 'services/analytics';
import { getSlug } from '../../Pages';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
}

export type LayoutType = 'single' | 'grid' | 'rows';

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public Selector({ model }: { model: LayoutSwitcher }) {
    const { active, options } = model.useState();

    return (
      <Field>
        <RadioButtonGroup options={options} value={active} onChange={model.onLayoutChange} />
      </Field>
    );
  }

  public onLayoutChange = (active: LayoutType) => {
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.layout_type_changed, {
      layout: active,
      view: getSlug(),
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
