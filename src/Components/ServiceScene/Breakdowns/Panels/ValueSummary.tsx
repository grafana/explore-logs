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
import {CollapsablePanelText, PanelMenu} from '../../../Panels/PanelMenu';
import {DrawStyle, PanelContext, SeriesVisibilityChangeMode, StackingMode} from '@grafana/ui';
import {setLevelColorOverrides, syncLogsPanelVisibleSeries} from '../../../../services/panel';
import {getPanelOption, setPanelOption} from '../../../../services/store';
import React from 'react';
import {getLevelsVariable} from "../../../../services/variableGetters";
import {toggleLevelFromFilter} from "../../../../services/levels";
import {reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES} from "../../../../services/analytics";
import {AddFilterEvent} from "../AddToFiltersButton";
import {LEVEL_VARIABLE_VALUE} from "../../../../services/variables";

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
      getPanelOption('collapsed', [CollapsablePanelText.collapsed, CollapsablePanelText.expanded]) ??
      CollapsablePanelText.expanded;
    const viz = buildValueSummaryPanel(this.state.title, { levelColor: this.state.levelColor });
    const height = getValueSummaryHeight(collapsed);

    viz.setState({
      extendPanelContext: (_, context) => this.extendTimeSeriesLegendBus(context),
    });

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
            newState.collapsed ? CollapsablePanelText.collapsed : CollapsablePanelText.expanded
          );
          setPanelOption(
            'collapsed',
            newState.collapsed ? CollapsablePanelText.collapsed : CollapsablePanelText.expanded
          );
        }
      })
    );
  }

  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    // if level variable
    const levelFilter = getLevelsVariable(this);
    this._subs.add(
        levelFilter?.subscribeToState((newState) => {
          const sceneFlexItem = this.state.body?.state.children[0]
          if(!(sceneFlexItem instanceof SceneFlexItem)){
            throw new Error('Cannot find sceneFlexItem')
          }
          const panel = sceneFlexItem.state.body
          if(!(panel instanceof VizPanel)){
            throw new Error('Cannot find VizPanel')
          }

          const $data = sceneGraph.getData(this);
          const dataFrame = $data.state.data?.series

          if (!dataFrame) {
            console.warn('no series?', dataFrame)
            return;
          }

          this.publishEvent(new AddFilterEvent('legend'), true);

          syncLogsPanelVisibleSeries(panel, dataFrame, this);
        })
    );

    context.onToggleSeriesVisibility = (level: string, mode: SeriesVisibilityChangeMode) => {
      // @TODO. We don't yet support filters with multiple values.
      if (mode === SeriesVisibilityChangeMode.AppendToSelection) {
        return;
      }

      const action = toggleLevelFromFilter(level, this);

      reportAppInteraction(
          USER_EVENTS_PAGES.service_details,
          USER_EVENTS_ACTIONS.service_details.level_in_logs_volume_clicked,
          {
            level,
            action,
          }
      );
    };
  };
}

export function setValueSummaryHeight(vizPanelFlexLayout: SceneFlexLayout, collapsableState: CollapsablePanelText) {
  const height = getValueSummaryHeight(collapsableState);
  vizPanelFlexLayout.setState({
    minHeight: height,
    height: height,
    maxHeight: height,
  });
}

function getValueSummaryHeight(collapsableState: CollapsablePanelText) {
  return collapsableState === CollapsablePanelText.collapsed ? 35 : 300;
}

function buildValueSummaryPanel(title: string, options?: { levelColor?: boolean }): VizPanel {
  const collapsed =
    getPanelOption('collapsed', [CollapsablePanelText.collapsed, CollapsablePanelText.expanded]) ??
    CollapsablePanelText.expanded;

  const body = PanelBuilders.timeseries()
    .setTitle(title)
    .setMenu(new PanelMenu({}))
    .setCollapsible(true)
    .setCollapsed(collapsed === CollapsablePanelText.collapsed)
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    // 11.5
    // .setShowMenuAlways(true)
    .setSeriesLimit(SUMMARY_PANEL_SERIES_LIMIT)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars);

  if (options?.levelColor) {
    body.setOverrides(setLevelColorOverrides);
  }
  return body.build();
}

export const VALUE_SUMMARY_PANEL_KEY = 'value_summary_panel';
