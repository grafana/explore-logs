import { CustomConstantVariableState } from '../../../services/CustomConstantVariable';
import { buildLokiQuery } from '../../../services/query';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLeverColorOverrides } from '../../../services/panel';
import { getSortByPreference } from '../../../services/store';
import { LoadingState, ReducerID } from '@grafana/data';
import { LayoutSwitcher } from './LayoutSwitcher';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import { getLabelValue } from './BreakdownSearchScene';
import { LOG_STREAM_SELECTOR_EXPR, VAR_LABELS } from '../../../services/variables';
import React from 'react';
import { LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from './LabelBreakdownScene';
import { ClearVariablesScene } from './ClearVariablesScene';

export function getLabelValuesQueryExpr(tagKey: string) {
  return `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${tagKey}!="" [$__auto])) by (${tagKey})`;
}

export interface LabelValuesBreakdownSceneState extends SceneObjectState {
  body?: SceneObject;
  variableState: CustomConstantVariableState;
}

export class LabelValuesBreakdownScene extends SceneObjectBase<LabelValuesBreakdownSceneState> {
  constructor(state: LabelValuesBreakdownSceneState) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }
  onActivate() {
    this.setState({
      body: this.buildLabelValuesLayout(this.state.variableState),
    });
  }
  buildLabelValuesLayout(variableState: CustomConstantVariableState): LayoutSwitcher {
    const tagKey = String(variableState?.value);
    const query = buildLokiQuery(getLabelValuesQueryExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

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

    const queryRunner = getQueryRunner(query);
    queryRunner.getResultsStream().subscribe((response) => {
      if (response.data.state === LoadingState.Done && !response.data.series.length) {
        const fieldsToClearCount = ClearVariablesScene.getCountOfFieldsToClear(this);
        console.log('fields to clear count', fieldsToClearCount);
        if (fieldsToClearCount) {
          this.setState({
            body: new ClearVariablesScene({ fieldsOnly: true }),
          });
        }
      }
    });

    return new LayoutSwitcher({
      $data: queryRunner,
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
        }),
      ],
    });
  }
  public static Component = ({ model }: SceneComponentProps<LabelValuesBreakdownScene>) => {
    const { body } = model.useState();
    console.log('body', body);

    return <>{body && <body.Component model={body} />}</>;
  };
}
