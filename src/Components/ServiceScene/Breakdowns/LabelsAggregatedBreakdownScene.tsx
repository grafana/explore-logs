import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItemLike,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { ALL_VARIABLE_VALUE, getLabelGroupByVariable } from '../../../services/variables';
import React from 'react';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS, LabelBreakdownScene } from './LabelBreakdownScene';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ValueSlugs } from '../../../services/routing';

export interface LabelsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}

export class LabelsAggregatedBreakdownScene extends SceneObjectBase<LabelsAggregatedBreakdownSceneState> {
  constructor(state: Partial<LabelsAggregatedBreakdownSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      body: this.build(),
    });
  }

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    labelBreakdownScene.state.search.reset();
    const children: SceneFlexItemLike[] = [];

    for (const option of variable.state.options) {
      const { value } = option;
      const optionValue = String(value);
      if (value === ALL_VARIABLE_VALUE || !value) {
        continue;
      }
      const query = buildLabelsQuery(this, String(option.value), String(option.value));

      children.push(
        new SceneCSSGridItem({
          body: PanelBuilders.timeseries()
            .setTitle(optionValue)
            .setData(getQueryRunner([query]))
            .setHeaderActions(new SelectLabelActionScene({ labelName: optionValue, fieldType: ValueSlugs.label }))
            .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
            .setCustomFieldConfig('fillOpacity', 100)
            .setCustomFieldConfig('lineWidth', 0)
            .setCustomFieldConfig('pointSize', 0)
            .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
            .setOverrides(setLevelColorOverrides)
            .build(),
        })
      );
    }

    return new LayoutSwitcher({
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        new SceneCSSGridLayout({
          isLazy: true,
          templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: children,
        }),
        new SceneCSSGridLayout({
          isLazy: true,
          templateColumns: '1fr',
          autoRows: '200px',
          children: children.map((child) => child.clone()),
        }),
      ],
    });
  }

  public static Selector({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) => {
    const { body } = model.useState();
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
