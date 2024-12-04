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
  VariableValueOption,
  VizPanel,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { ALL_VARIABLE_VALUE, LEVEL_VARIABLE_VALUE } from '../../../services/variables';
import React from 'react';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ValueSlugs } from '../../../services/routing';
import { limitMaxNumberOfSeriesForPanel, MAX_NUMBER_OF_TIME_SERIES } from './TimeSeriesLimitSeriesTitleItem';
import { limitFramesTransformation } from './FieldsAggregatedBreakdownScene';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from '../../../services/labels';
import { getFieldsVariable, getLabelGroupByVariable } from '../../../services/variableGetters';
import { LokiQuery } from '../../../services/lokiQuery';
import { ServiceScene } from '../ServiceScene';
import { DataFrame, LoadingState } from '@grafana/data';
import { PanelMenu, getPanelWrapperStyles } from '../../Panels/PanelMenu';
import { logger } from '../../../services/logger';

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
    const $detectedLabels = serviceScene.state.$detectedLabelsData;

    // If the body hasn't been built yet, build it
    if (!this.state.body) {
      this.setState({
        body: this.build(),
      });
    }
    // Otherwise if we have the detected labels done loading, update the body
    else if ($detectedLabels?.state.data?.state === LoadingState.Done) {
      this.update($detectedLabels?.state.data.series[0]);
    }

    this._subs.add(
      $detectedLabels?.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          this.update(newState.data.series[0]);
        }
      })
    );

    this._subs.add(
      fields.subscribeToState(() => {
        this.updateQueriesOnFieldsVariableChange();
      })
    );
  }

  private updateQueriesOnFieldsVariableChange = () => {
    this.state.body?.state.layouts.forEach((layoutObj) => {
      const layout = layoutObj as SceneCSSGridLayout;
      // Iterate through the existing panels
      for (let i = 0; i < layout.state.children.length; i++) {
        const { panel, title } = this.getPanelByIndex(layout, i);
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

  private getPanelByIndex(layout: SceneCSSGridLayout, i: number) {
    const gridItem = layout.state.children[i] as SceneCSSGridItem;
    const panel = gridItem.state.body as VizPanel;

    const title = panel.state.title;
    return { panel, title };
  }

  private update(detectedLabelsFrame: DataFrame) {
    const variable = getLabelGroupByVariable(this);
    const newLabels = variable.state.options.filter((opt) => opt.value !== ALL_VARIABLE_VALUE).map((opt) => opt.label);

    this.state.body?.state.layouts.forEach((layoutObj) => {
      let existingLabels = [];
      const layout = layoutObj as SceneCSSGridLayout;
      const newLabelsSet = new Set<string>(newLabels);
      const updatedChildren = layout.state.children as SceneCSSGridItem[];

      for (let i = 0; i < updatedChildren.length; i++) {
        const { title } = this.getPanelByIndex(layout, i);

        if (newLabelsSet.has(title)) {
          // If the new response has this field, delete it from the set, but leave it in the layout
          newLabelsSet.delete(title);
        } else {
          // Otherwise if the panel doesn't exist in the response, delete it from the layout
          updatedChildren.splice(i, 1);
          // And make sure to update the index, or we'll skip the next one
          i--;
        }
        existingLabels.push(title);
      }

      const labelsToAdd = Array.from(newLabelsSet);

      const options = labelsToAdd.map((fieldName) => {
        return {
          label: fieldName,
          value: fieldName,
        };
      });

      updatedChildren.push(...this.buildChildren(options));

      const cardinalityMap = this.calculateCardinalityMap(detectedLabelsFrame);
      updatedChildren.sort(this.sortChildren(cardinalityMap));
      updatedChildren.map((child) => {
        this.addLimitUIToChild(child);
      });

      layout.setState({
        children: updatedChildren,
      });
    });
  }

  private addLimitUIToChild(child: SceneCSSGridItem) {
    const panel = child.state.body;
    const dataTransformer = child.state.body?.state.$data;
    if (panel instanceof VizPanel && dataTransformer instanceof SceneDataTransformer) {
      limitMaxNumberOfSeriesForPanel(panel, dataTransformer);
    } else {
      logger.error(new Error('unable to locate VizPanel or transformer'), {
        msg: 'unable to locate VizPanel or transformer',
      });
    }
  }

  private calculateCardinalityMap(detectedLabels?: DataFrame) {
    const cardinalityMap = new Map<string, number>();
    if (detectedLabels?.length) {
      for (let i = 0; i < detectedLabels?.fields.length; i++) {
        const name: string = detectedLabels.fields[i].name;
        const cardinality: number = detectedLabels.fields[i].values[0];
        cardinalityMap.set(name, cardinality);
      }
    }
    return cardinalityMap;
  }

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    labelBreakdownScene.state.search.reset();

    const children = this.buildChildren(variable.state.options);

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const $detectedLabels = serviceScene.state.$detectedLabelsData;
    if ($detectedLabels?.state.data?.state === LoadingState.Done) {
      const cardinalityMap = this.calculateCardinalityMap($detectedLabels?.state.data.series[0]);
      children.sort(this.sortChildren(cardinalityMap));
    }

    const childrenClones = children.map((child) => child.clone());

    // We must subscribe to the data providers for all children after the clone or we'll see bugs in the row layout
    [...children, ...childrenClones].map((child) => {
      this.addLimitUIToChild(child);
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
          children: childrenClones,
        }),
      ],
    });
  }

  private buildChildren(options: VariableValueOption[]) {
    const children: SceneCSSGridItem[] = [];
    for (const option of options) {
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
            .setHeaderActions([new SelectLabelActionScene({ labelName: optionValue, fieldType: ValueSlugs.label })])
            .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
            .setCustomFieldConfig('fillOpacity', 100)
            .setCustomFieldConfig('lineWidth', 0)
            .setCustomFieldConfig('pointSize', 0)
            .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
            .setHoverHeader(false)
            .setOverrides(setLevelColorOverrides)
            .setMenu(new PanelMenu({ labelName: optionValue }))
            .build(),
        })
      );
    }
    return children;
  }

  private sortChildren(cardinalityMap: Map<string, number>) {
    return (a: SceneCSSGridItem, b: SceneCSSGridItem) => {
      const aPanel = a.state.body as VizPanel;
      const bPanel = b.state.body as VizPanel;
      if (aPanel.state.title === LEVEL_VARIABLE_VALUE) {
        return -1;
      }
      if (bPanel.state.title === LEVEL_VARIABLE_VALUE) {
        return 1;
      }
      const aCardinality = cardinalityMap.get(aPanel.state.title) ?? 0;
      const bCardinality = cardinalityMap.get(bPanel.state.title) ?? 0;
      return bCardinality - aCardinality;
    };
  }

  private getDataTransformer(query: LokiQuery) {
    const queryRunner = getQueryRunner([query]);
    return new SceneDataTransformer({
      $data: queryRunner,
      transformations: [() => limitFramesTransformation(MAX_NUMBER_OF_TIME_SERIES)],
    });
  }

  public static Selector({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelsAggregatedBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);

    if (body) {
      return <span className={styles.panelWrapper}>{body && <body.Component model={body} />}</span>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
