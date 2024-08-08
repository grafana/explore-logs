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
import { DrawStyle, LoadingPlaceholder } from '@grafana/ui';
import { getSortByPreference } from '../../../services/store';
import { ReducerID } from '@grafana/data';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import { getFieldGroupByVariable, VAR_FIELDS } from '../../../services/variables';
import React from 'react';
import { FIELD_LAYOUT_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';

export interface FieldValueBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  $data: SceneDataProvider;
}

export class FieldValueBreakdownScene extends SceneObjectBase<FieldValueBreakdownSceneState> {
  constructor(state: Partial<FieldValueBreakdownSceneState> & { $data: SceneDataProvider }) {
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
    const variable = getFieldGroupByVariable(this);
    const variableState = variable.state;
    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    const tagKey = String(variableState.value);

    const isAvg = isAvgField(tagKey);
    const { sortBy, direction } = getSortByPreference('fields', ReducerID.stdDev, 'desc');
    const getFilter = () => fieldsBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
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
            templateColumns: FIELD_LAYOUT_GRID_TEMPLATE_COLUMNS,
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
            isAvg ? DrawStyle.Bars : DrawStyle.Line,
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
            isAvg ? DrawStyle.Bars : DrawStyle.Line,
            VAR_FIELDS
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  public static Selector({ model }: SceneComponentProps<FieldValueBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldValueBreakdownScene>) => {
    const { body } = model.useState();
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}

// function getExpr(field: string) {
//   if (isAvgField(field)) {
//     return (
//       `avg_over_time(${LOG_STREAM_SELECTOR_EXPR} | unwrap ` +
//       (field === 'duration' ? `duration` : field === 'bytes' ? `bytes` : ``) +
//       `(${field}) [$__auto]) by ()`
//     );
//   }
//   return `sum by (${field}) (count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${field}!=""   [$__auto]))`;
// }

function isAvgField(field: string) {
  return avgFields.includes(field);
}

const avgFields = ['duration', 'count', 'total', 'bytes'];
