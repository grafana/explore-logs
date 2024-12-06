import React from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, RadioButtonGroup, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { getDrilldownSlug } from '../../../services/routing';
import { css } from '@emotion/css';

export interface LayoutSwitcherState extends SceneObjectState {
  active: LayoutType;
  layouts: SceneObject[];
  options: Array<SelectableValue<LayoutType>>;
}

export type LayoutType = 'single' | 'grid' | 'rows';

export class LayoutSwitcher extends SceneObjectBase<LayoutSwitcherState> {
  public static Selector = LayoutSwitcherComponent;

  public onLayoutChange = (active: LayoutType) => {
    reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.layout_type_changed, {
      layout: active,
      view: getDrilldownSlug(),
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

function LayoutSwitcherComponent({ model }: { model: LayoutSwitcher }) {
  const { active, options } = model.useState();
  const styles = useStyles2(getStyles);

  return (
    <Field className={styles.field}>
      <RadioButtonGroup options={options} value={active} onChange={model.onLayoutChange} />
    </Field>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    field: css({
      marginBottom: 0,
    }),
  };
};
