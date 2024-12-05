import { PanelBuilders, SceneFlexItem, sceneGraph, VizPanel } from '@grafana/scenes';
import { CollapsablePanelType, PanelMenu } from '../../../Panels/PanelMenu';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { setLevelColorOverrides } from '../../../../services/panel';
import { getPanelOption } from '../../../../services/store';
import { Options } from '@grafana/schema/dist/esm/raw/composable/timeseries/panelcfg/x/TimeSeriesPanelCfg_types.gen';

const SUMMARY_PANEL_SERIES_LIMIT = 100;

export function getValueSummaryPanel(title: string, options?: { levelColor?: boolean }) {
  const collapsed =
    getPanelOption('collapsed', [CollapsablePanelType.collapsed, CollapsablePanelType.expanded]) ??
    CollapsablePanelType.collapsed;

  const body = PanelBuilders.timeseries()
    .setTitle(title)
    .setMenu(new PanelMenu({}))
    .setCollapsible(true)
    .setCollapsed(collapsed === CollapsablePanelType.collapsed)
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setSeriesLimit(SUMMARY_PANEL_SERIES_LIMIT)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars);

  if (options?.levelColor) {
    body.setOverrides(setLevelColorOverrides);
  }
  const build: VizPanel<Options> = body.build();

  build.addActivationHandler(() => {
    if (build.state.collapsible) {
      // @todo handle unsub
      build.subscribeToState((newState, prevState) => {
        if (newState.collapsed !== prevState.collapsed) {
          const vizPanelFlexItem = sceneGraph.getAncestor(build, SceneFlexItem);
          setValueSummaryHeight(
            vizPanelFlexItem,
            newState.collapsed ? CollapsablePanelType.collapsed : CollapsablePanelType.expanded
          );
        }
      });
    }
  });

  return new SceneFlexItem({
    key: VALUE_SUMMARY_PANEL_KEY,
    minHeight: getValueSummaryHeight(collapsed),
    height: getValueSummaryHeight(collapsed),
    maxHeight: getValueSummaryHeight(collapsed),
    body: build,
  });
}

export function setValueSummaryHeight(vizPanelFlexItem: SceneFlexItem, collapsableState: CollapsablePanelType) {
  vizPanelFlexItem.setState({
    minHeight: getValueSummaryHeight(collapsableState),
    height: getValueSummaryHeight(collapsableState),
    maxHeight: getValueSummaryHeight(collapsableState),
  });
}

function getValueSummaryHeight(collapsableState: CollapsablePanelType) {
  return collapsableState === CollapsablePanelType.collapsed ? 35 : 300;
}

export const VALUE_SUMMARY_PANEL_KEY = 'value_summary_panel';
