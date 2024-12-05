import {
  PanelBuilders,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { CollapsablePanelType, PanelMenu } from '../../../Panels/PanelMenu';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { setLevelColorOverrides } from '../../../../services/panel';
import { getPanelOption, setPanelOption } from '../../../../services/store';
import React from 'react';

const SUMMARY_PANEL_SERIES_LIMIT = 100;

interface ValueSummaryPanelSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
  title: string;
  levelColor?: boolean;
}
export class ValueSummaryPanelScene extends SceneObjectBase<ValueSummaryPanelSceneState> {
  constructor(state: ValueSummaryPanelSceneState) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<ValueSummaryPanelScene>) => {
    const { body } = model.useState();
    if (body) {
      return (
        <div>
          <body.Component model={body} />
        </div>
      );
    }

    return null;
  };

  onActivate() {
    const collapsed =
      getPanelOption('collapsed', [CollapsablePanelType.collapsed, CollapsablePanelType.expanded]) ??
      CollapsablePanelType.expanded;
    const viz = buildValueSummaryPanel(this.state.title, { levelColor: this.state.levelColor });
    const height = getValueSummaryHeight(collapsed);

    this.setState({
      body: new SceneFlexLayout({
        key: VALUE_SUMMARY_PANEL_KEY,
        minHeight: height,
        height: height,
        maxHeight: height,
        wrap: 'nowrap',
        children: [
          new SceneFlexItem({
            body: viz,
          }),
        ],
      }),
    });

    this._subs.add(
      viz.subscribeToState((newState, prevState) => {
        if (newState.collapsed !== prevState.collapsed) {
          const vizPanelFlexLayout = sceneGraph.getAncestor(viz, SceneFlexLayout);
          setValueSummaryHeight(
            vizPanelFlexLayout,
            newState.collapsed ? CollapsablePanelType.collapsed : CollapsablePanelType.expanded
          );
          setPanelOption(
            'collapsed',
            newState.collapsed ? CollapsablePanelType.collapsed : CollapsablePanelType.expanded
          );
        }
      })
    );
  }
}

export function setValueSummaryHeight(vizPanelFlexLayout: SceneFlexLayout, collapsableState: CollapsablePanelType) {
  const height = getValueSummaryHeight(collapsableState);
  vizPanelFlexLayout.setState({
    minHeight: height,
    height: height,
    maxHeight: height,
  });
}

function getValueSummaryHeight(collapsableState: CollapsablePanelType) {
  return collapsableState === CollapsablePanelType.collapsed ? 35 : 300;
}

function buildValueSummaryPanel(title: string, options?: { levelColor?: boolean }): VizPanel {
  const collapsed =
    getPanelOption('collapsed', [CollapsablePanelType.collapsed, CollapsablePanelType.expanded]) ??
    CollapsablePanelType.expanded;

  const body = PanelBuilders.timeseries()
    .setTitle(title)
    .setMenu(new PanelMenu({}))
    .setCollapsible(true)
    .setCollapsed(collapsed === CollapsablePanelType.collapsed)
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setShowMenuAlways(true)
    .setSeriesLimit(SUMMARY_PANEL_SERIES_LIMIT)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars);

  if (options?.levelColor) {
    body.setOverrides(setLevelColorOverrides);
  }
  return body.build();
}

export const VALUE_SUMMARY_PANEL_KEY = 'value_summary_panel';
