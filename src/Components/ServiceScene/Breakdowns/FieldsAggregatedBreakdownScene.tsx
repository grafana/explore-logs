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
import { ALL_VARIABLE_VALUE, getFieldGroupByVariable } from '../../../services/variables';
import { buildDataQuery } from '../../../services/query';
import { getQueryRunner, setLeverColorOverrides } from '../../../services/panel';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { LayoutSwitcher } from './LayoutSwitcher';
import {
  FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
  FieldsBreakdownScene,
  getFieldBreakdownExpr,
  isAvgField,
} from './FieldsBreakdownScene';
import { ServiceScene } from '../ServiceScene';
import React from 'react';
import { SelectFieldActionScene } from './SelectFieldActionScene';

export interface FieldsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}

export class FieldsAggregatedBreakdownScene extends SceneObjectBase<FieldsAggregatedBreakdownSceneState> {
  constructor(state: Partial<FieldsAggregatedBreakdownSceneState>) {
    super(state);

    console.log('FieldsAggregatedBreakdownScene constructor', state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    console.log('FieldsAggregatedBreakdownScene activation', this.state);
    this.setState({
      body: this.build(),
    });
  }
  private build() {
    const groupByVariable = getFieldGroupByVariable(this);
    const options = groupByVariable.state.options.map((opt) => ({ label: opt.label, value: String(opt.value) }));

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.search.reset();

    const children: SceneFlexItemLike[] = [];
    for (const option of options) {
      const { value: optionValue } = option;
      if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
        continue;
      }

      const query = buildDataQuery(getFieldBreakdownExpr(optionValue), {
        legendFormat: `{{${optionValue}}}`,
        refId: optionValue,
      });
      const queryRunner = getQueryRunner([query]);
      let body = PanelBuilders.timeseries().setTitle(optionValue).setData(queryRunner);

      if (!isAvgField(optionValue)) {
        body = body
          .setHeaderActions(new SelectFieldActionScene({ labelName: String(optionValue) }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .setOverrides(setLeverColorOverrides);
      }
      const gridItem = new SceneCSSGridItem({
        body: body.build(),
      });

      this._subs.add(
        queryRunner.getResultsStream().subscribe((result) => {
          if (result.data.errors && result.data.errors.length > 0) {
            const val = result.data.errors[0].refId!;
            this.hideField(val);
            gridItem.setState({ isHidden: true });
          }
        })
      );

      children.push(gridItem);
    }

    return new LayoutSwitcher({
      options: [
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        new SceneCSSGridLayout({
          templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
          autoRows: '200px',
          children: children,
          isLazy: true,
        }),
        new SceneCSSGridLayout({
          templateColumns: '1fr',
          autoRows: '200px',
          children: children.map((child) => child.clone()),
          isLazy: true,
        }),
      ],
    });
  }

  private hideField(field: string) {
    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    const logsScene = sceneGraph.getAncestor(this, ServiceScene);
    const fields = logsScene.state.fields?.filter((f) => f !== field);

    if (fields) {
      fieldsBreakdownScene.state.changeFields?.(fields.filter((f) => f !== ALL_VARIABLE_VALUE).map((f) => f));
    }
  }

  public static Selector({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldsAggregatedBreakdownScene>) => {
    const { body } = model.useState();
    console.log('render fields aggregated breakdown scene', model.state);
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
