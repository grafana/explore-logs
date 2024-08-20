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
import { ALL_VARIABLE_VALUE, getFieldGroupByVariable, getFieldsVariable } from '../../../services/variables';
import { buildDataQuery } from '../../../services/query';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
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
import { areArraysEqual } from '../../../services/comparison';

export interface FieldsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}

export class FieldsAggregatedBreakdownScene extends SceneObjectBase<FieldsAggregatedBreakdownSceneState> {
  constructor(state: Partial<FieldsAggregatedBreakdownSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      body: this.build(),
    });

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const fieldsVariable = getFieldsVariable(this);
    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);

    fieldsVariable.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.filters, prevState.filters)) {
        // Variables changing could cause a different set of filters to be returned, to prevent the current panels from executing queries that will get cancelled we null out the body
        this.setState({
          body: undefined,
        });

        // But what if the filters change, but the list of fields doesn't? We won't re-build the body, so let's clear out the fields
        serviceScene.setState({
          fields: undefined,
        });

        // And set the loading state on parent
        fieldsBreakdownScene.setState({
          loading: true,
        });
      }
    });

    serviceScene.subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.fields, prevState.fields)) {
        this.setState({
          body: this.build(),
        });
      }
    });
  }
  private build() {
    const groupByVariable = getFieldGroupByVariable(this);
    const options = groupByVariable.state.options.map((opt) => ({ label: opt.label, value: String(opt.value) }));

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.search.reset();

    const children = this.buildChildren(options);

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

  private buildChildren(options: Array<{ label: string; value: string }>) {
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
          .setOverrides(setLevelColorOverrides);
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
    return children;
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
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
