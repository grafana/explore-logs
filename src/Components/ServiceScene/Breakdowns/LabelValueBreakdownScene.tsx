import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getLabelValue } from './SortByScene';
import { buildDataQuery } from '../../../services/query';
import { getTimeSeriesExpr } from '../../../services/expressions';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { setLeverColorOverrides } from '../../../services/panel';
import { getSortByPreference } from '../../../services/store';
import { ReducerID } from '@grafana/data';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import { getLabelGroupByVariable, VAR_LABELS } from '../../../services/variables';
import React from 'react';
import { LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS, LabelBreakdownScene } from './LabelBreakdownScene';

export interface LabelValueBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  $data: SceneDataProvider;
}

export class LabelValueBreakdownScene extends SceneObjectBase<LabelValueBreakdownSceneState> {
  constructor(state: Partial<LabelValueBreakdownSceneState> & { $data: SceneDataProvider }) {
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
    const variableState = variable.state;
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    const tagKey = String(variableState?.value);
    const query = buildDataQuery(getTimeSeriesExpr(this, tagKey), { legendFormat: `{{${tagKey}}}` });

    let bodyOpts = PanelBuilders.timeseries();
    bodyOpts = bodyOpts
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLeverColorOverrides)
      .setTitle(tagKey);

    const body = bodyOpts.build();
    const { sortBy, direction } = getSortByPreference('labels', ReducerID.stdDev, 'desc');

    const getFilter = () => labelBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
      // $data: getQueryRunner([query]),
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
              body,
            }),
          ],
        }),
        new ByFrameRepeater({
          body: new SceneCSSGridLayout({
            isLazy: true,
            templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
            autoRows: '200px',
            children: [
              new SceneFlexItem({
                body: new SceneReactObject({
                  reactNode: <LoadingPlaceholder text="Loading..." />,
                }),
              }),
            ],
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_LABELS
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
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
            VAR_LABELS
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  public static Selector({ model }: SceneComponentProps<LabelValueBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelValueBreakdownScene>) => {
    const { body } = model.useState();
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
