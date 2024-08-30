import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
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
import { limitMaxNumberOfSeriesForPanel, MAX_NUMBER_OF_TIME_SERIES } from './TimeSeriesLimitSeriesTitleItem';
import { limitFramesTransformation } from './FieldsAggregatedBreakdownScene';
import { LokiQuery } from '../../../services/query';

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
    this.setState({
      body: this.build(),
    });

    this._subs.add(
      fields.subscribeToState((newState, prevState) => {
        //@todo only when changes? Loading? etc
        this.updateQueriesOnFieldsChange();
      })
    );
  }

  private updateQueriesOnFieldsChange = () => {
    this.state.body?.state.layouts.forEach((layoutObj) => {
      const layout = layoutObj as SceneCSSGridLayout;
      // Iterate through the existing panels
      for (let i = 0; i < layout.state.children.length; i++) {
        const gridItem = layout.state.children[i] as SceneCSSGridItem;
        const panel = gridItem.state.body as VizPanel;

        const title = panel.state.title;
        const queryRunner: SceneDataProvider | SceneQueryRunner | undefined = panel.state.$data;
        const query = buildLabelsQuery(this, title, title);

        // Don't update if query didn't change
        if (queryRunner instanceof SceneQueryRunner) {
          if (query.expr === queryRunner?.state.queries?.[0]?.expr) {
            break;
          }
        }

        panel.setState({
          $data: this.getDataTransformer(query),
        });
      }
    });
  };

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    labelBreakdownScene.state.search.reset();
    const children: SceneCSSGridItem[] = [];

    for (const option of variable.state.options) {
      const { value } = option;
      const optionValue = String(value);
      if (value === ALL_VARIABLE_VALUE || !value) {
        continue;
      }
      const query = buildLabelsQuery(this, String(option.value), String(option.value));
      const dataTransformer = this.getDataTransformer(query);

      children.push(
        new SceneCSSGridItem({
          body: PanelBuilders.timeseries()
            .setTitle(optionValue)
            .setData(dataTransformer)
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

    const childrenClones = children.map((child) => child.clone());

    // We must subscribe to the data providers for all children after the clone or we'll see bugs in the row layout
    [...children, ...childrenClones].map((child) => {
      limitMaxNumberOfSeriesForPanel(child);
    });

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

  private getDataTransformer(query: LokiQuery) {
    const queryRunner = getQueryRunner([query]);
    return new SceneDataTransformer({
      $data: queryRunner,
      transformations: [() => limitFramesTransformation(MAX_NUMBER_OF_TIME_SERIES, queryRunner)],
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
