import {
  PanelBuilders,
  QueryRunnerState,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataTransformer,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { ALL_VARIABLE_VALUE, getFieldGroupByVariable, getFieldsVariable } from '../../../services/variables';
import { buildDataQuery } from '../../../services/query';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { LayoutSwitcher } from './LayoutSwitcher';
import { FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';
import {
  getDetectedFieldsFrame,
  getDetectedFieldsFrameFromQueryRunnerState,
  getDetectedFieldsNamesFromQueryRunnerState,
  ServiceScene,
} from '../ServiceScene';
import React from 'react';
import { SelectLabelActionScene } from './SelectLabelActionScene';
import { ValueSlugs } from '../../../services/routing';
import { areArraysEqual } from '../../../services/comparison';
import { DataFrame, LoadingState } from '@grafana/data';
import { limitMaxNumberOfSeriesForPanel, MAX_NUMBER_OF_TIME_SERIES } from './TimeSeriesLimitSeriesTitleItem';
import { map, Observable } from 'rxjs';
import { buildFieldsQueryString, isAvgField } from '../../../services/fields';

export interface FieldsAggregatedBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}

export class FieldsAggregatedBreakdownScene extends SceneObjectBase<FieldsAggregatedBreakdownSceneState> {
  constructor(state: Partial<FieldsAggregatedBreakdownSceneState>) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onDetectedFieldsChange = (newState: QueryRunnerState, prevState: QueryRunnerState) => {
    const newNamesField = getDetectedFieldsNamesFromQueryRunnerState(newState);
    const prevNamesField = getDetectedFieldsNamesFromQueryRunnerState(prevState);

    if (newState.data?.state === LoadingState.Done && !areArraysEqual(newNamesField?.values, prevNamesField?.values)) {
      //@todo cardinality looks wrong in API response
      const cardinalityMap = this.calculateCardinalityMap(newState);

      // Iterate through all the layouts
      this.state.body?.state.layouts.forEach((layoutObj) => {
        const layout = layoutObj as SceneCSSGridLayout;
        // populate set of new list of fields
        const newFieldsSet = new Set<string>(newNamesField?.values);
        const updatedChildren = layout.state.children as SceneCSSGridItem[];

        // Iterate through all the existing panels
        for (let i = 0; i < updatedChildren.length; i++) {
          const gridItem = layout.state.children[i] as SceneCSSGridItem;
          const panel = gridItem.state.body as VizPanel;

          if (newFieldsSet.has(panel.state.title)) {
            // If the new response has this field, delete it from the set, but leave it in the layout
            newFieldsSet.delete(panel.state.title);
          } else {
            // Otherwise if the panel doesn't exist in the response, delete it from the layout
            updatedChildren.splice(i, 1);
            // And make sure to update the index, or we'll skip the next one
            i--;
          }
        }

        const fieldsToAdd = Array.from(newFieldsSet);
        const options = fieldsToAdd.map((fieldName) => {
          return {
            label: fieldName,
            value: fieldName,
          };
        });

        updatedChildren.push(...this.buildChildren(options));
        updatedChildren.sort(this.sortChildren(cardinalityMap));

        updatedChildren.map((child) => {
          limitMaxNumberOfSeriesForPanel(child);
          this.subscribeToPanel(child);
        });

        layout.setState({
          children: updatedChildren,
        });
      });
    }
  };

  private sortChildren(cardinalityMap: Map<string, number>) {
    return (a: SceneCSSGridItem, b: SceneCSSGridItem) => {
      const aPanel = a.state.body as VizPanel;
      const bPanel = b.state.body as VizPanel;
      const aCardinality = cardinalityMap.get(aPanel.state.title) ?? 0;
      const bCardinality = cardinalityMap.get(bPanel.state.title) ?? 0;
      return bCardinality - aCardinality;
    };
  }

  private calculateCardinalityMap(newState?: QueryRunnerState) {
    const detectedFieldsFrame = getDetectedFieldsFrameFromQueryRunnerState(newState);
    const cardinalityMap = new Map<string, number>();
    if (detectedFieldsFrame?.length) {
      for (let i = 0; i < detectedFieldsFrame?.length; i++) {
        const name: string = detectedFieldsFrame.fields[0].values[i];
        const cardinality: number = detectedFieldsFrame.fields[1].values[i];
        cardinalityMap.set(name, cardinality);
      }
    }
    return cardinalityMap;
  }

  onActivate() {
    this.setState({
      body: this.build(),
    });

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    this._subs.add(serviceScene.state.$detectedFieldsData?.subscribeToState(this.onDetectedFieldsChange));
  }
  private build() {
    const groupByVariable = getFieldGroupByVariable(this);
    const options = groupByVariable.state.options.map((opt) => ({ label: opt.label, value: String(opt.value) }));

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    fieldsBreakdownScene.state.search.reset();

    const children = this.buildChildren(options);

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene);
    const cardinalityMap = this.calculateCardinalityMap(serviceScene.state.$detectedFieldsData?.state);
    children.sort(this.sortChildren(cardinalityMap));
    const childrenClones = children.map((child) => child.clone());

    // We must subscribe to the data providers for all children after the clone, or we'll see bugs in the row layout
    [...children, ...childrenClones].map((child) => {
      limitMaxNumberOfSeriesForPanel(child);
      this.subscribeToPanel(child);
    });

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
          children: childrenClones,
          isLazy: true,
        }),
      ],
    });
  }

  private subscribeToPanel(child: SceneCSSGridItem) {
    const panel = child.state.body as VizPanel | undefined;
    if (panel) {
      this._subs.add(
        panel?.state.$data?.getResultsStream().subscribe((result) => {
          if (result.data.errors && result.data.errors.length > 0) {
            const val = result.data.errors[0].refId!;
            this.hideField(val);
            child.setState({ isHidden: true });
          }
        })
      );
    }
  }

  private buildChildren(options: Array<{ label: string; value: string }>): SceneCSSGridItem[] {
    const children: SceneCSSGridItem[] = [];
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const fieldsVariable = getFieldsVariable(this);

    for (const option of options) {
      const { value: optionValue } = option;
      if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
        continue;
      }

      const queryString = buildFieldsQueryString(optionValue, fieldsVariable, detectedFieldsFrame);
      const query = buildDataQuery(queryString, {
        legendFormat: `{{${optionValue}}}`,
        refId: optionValue,
      });

      const queryRunner = getQueryRunner([query]);

      const dataTransformer = new SceneDataTransformer({
        $data: queryRunner,
        transformations: [() => limitFramesTransformation(MAX_NUMBER_OF_TIME_SERIES)],
      });
      let body = PanelBuilders.timeseries().setTitle(optionValue).setData(dataTransformer);

      if (!isAvgField(optionValue)) {
        body = body
          .setHeaderActions(new SelectLabelActionScene({ labelName: String(optionValue), fieldType: ValueSlugs.field }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .setOverrides(setLevelColorOverrides);
      } else {
        body = body.setHeaderActions(
          new SelectLabelActionScene({
            labelName: String(optionValue),
            hideValueDrilldown: true,
            fieldType: ValueSlugs.field,
          })
        );
      }

      const viz = body.build();
      const gridItem = new SceneCSSGridItem({
        body: viz,
      });

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

export function limitFramesTransformation(limit: number) {
  return (source: Observable<DataFrame[]>) => {
    return source.pipe(
      map((frames) => {
        return frames.slice(0, limit);
      })
    );
  };
}
