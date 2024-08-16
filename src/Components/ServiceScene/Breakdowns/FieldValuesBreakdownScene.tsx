import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { buildDataQuery } from '../../../services/query';
import { getSortByPreference } from '../../../services/store';
import { ReducerID } from '@grafana/data';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getQueryRunner } from '../../../services/panel';
import { ByFrameRepeater } from './ByFrameRepeater';
import { DrawStyle, LoadingPlaceholder } from '@grafana/ui';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import { getLabelValue } from './SortByScene';
import { getFieldGroupByVariable, VAR_FIELDS } from '../../../services/variables';
import React from 'react';
import {
  FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
  FieldsBreakdownScene,
  getFieldBreakdownExpr,
} from './FieldsBreakdownScene';

export interface FieldValuesBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
}
export class FieldValuesBreakdownScene extends SceneObjectBase<FieldValuesBreakdownSceneState> {
  constructor(state: Partial<FieldValuesBreakdownSceneState>) {
    super(state);
    console.log('FieldValuesBreakdownScene constructor', state);

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
    const tagKey = String(groupByVariable.state.value);
    const query = buildDataQuery(getFieldBreakdownExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

    const { sortBy, direction } = getSortByPreference('fields', ReducerID.stdDev, 'desc');

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    const getFilter = () => fieldsBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
      $data: getQueryRunner([query]),
      options: [
        { value: 'single', label: 'Single' },
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle(tagKey).build(),
            }),
          ],
        }),
        new ByFrameRepeater({
          body: new SceneCSSGridLayout({
            templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
            autoRows: '200px',
            children: [
              new SceneFlexItem({
                body: new SceneReactObject({
                  reactNode: <LoadingPlaceholder text="Loading..." />,
                }),
              }),
            ],
            isLazy: true,
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_FIELDS
          ),
          sortBy,
          direction,
          getFilter,
        }),
        new ByFrameRepeater({
          body: new SceneCSSGridLayout({
            templateColumns: '1fr',
            autoRows: '200px',
            children: [
              new SceneFlexItem({
                body: new SceneReactObject({
                  reactNode: <LoadingPlaceholder text="Loading..." />,
                }),
              }),
            ],
            isLazy: true,
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_FIELDS
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  public static Selector({ model }: SceneComponentProps<FieldValuesBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldValuesBreakdownScene>) => {
    const { body } = model.useState();
    console.log('render fields aggregated breakdown scene', model.state);
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
