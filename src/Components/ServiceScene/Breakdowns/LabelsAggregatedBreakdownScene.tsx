import {
  PanelBuilders,
  QueryRunnerState,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItemLike,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { ALL_VARIABLE_VALUE, getFieldsVariable, getLabelGroupByVariable } from '../../../services/variables';
import React from 'react';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS, LabelBreakdownScene } from './LabelBreakdownScene';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ValueSlugs } from '../../../services/routing';
import { getDetectedFieldsNamesFromQueryRunnerState, ServiceScene } from '../ServiceScene';
import { LoadingState } from '@grafana/data';
import { areArraysEqual } from '../../../services/comparison';

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
    const fields = getFieldsVariable(this);
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const $detectedFieldsData = serviceScene.state.$detectedFieldsData;
    if (fields.state.filters.length === 0 || $detectedFieldsData.state.data?.state === LoadingState.Done) {
      this.setState({
        body: this.build(),
      });
    }

    this._subs.add(
      $detectedFieldsData.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          if (!this.state.body) {
            this.setState({
              body: this.build(),
            });
          } else {
            this.updateQueriesOnDetectedFieldsChange(newState, prevState);
          }
        }
      })
    );
  }

  private updateQueriesOnDetectedFieldsChange = (newState: QueryRunnerState, prevState: QueryRunnerState) => {
    const newNamesField = getDetectedFieldsNamesFromQueryRunnerState(newState);
    const prevNamesField = getDetectedFieldsNamesFromQueryRunnerState(prevState);

    if (newState.data?.state === LoadingState.Done && !areArraysEqual(newNamesField?.values, prevNamesField?.values)) {
      console.log('updating queries');
      // Iterate through all of the layouts
      this.state.body?.state.layouts.forEach((layoutObj) => {
        const layout = layoutObj as SceneCSSGridLayout;
        // Iterate through all of the existing panels
        for (let i = 0; i < layout.state.children.length; i++) {
          const gridItem = layout.state.children[i] as SceneCSSGridItem;
          const panel = gridItem.state.body as VizPanel;
          const title = panel.state.title;
          const query = buildLabelsQuery(this, title, title);

          panel.setState({
            $data: getQueryRunner([query]),
          });
        }
      });
    }
  };

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
