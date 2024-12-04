import { PanelBuilders, SceneFlexItem, VizPanel } from '@grafana/scenes';
import { CollapsablePanelType, PanelMenu } from '../../../Panels/PanelMenu';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { setLevelColorOverrides } from '../../../../services/panel';
import { getPanelOption } from '../../../../services/store';
import { Options } from '@grafana/schema/dist/esm/raw/composable/timeseries/panelcfg/x/TimeSeriesPanelCfg_types.gen';

export function getValueSummaryPanel(title: string, options?: { levelColor?: boolean }) {
  const collapsable =
    getPanelOption('collapsable', [CollapsablePanelType.collapse, CollapsablePanelType.expand]) ??
    CollapsablePanelType.collapse;

  const body = PanelBuilders.timeseries()
    .setTitle(title)
    .setMenu(
      new PanelMenu({
        collapsable,
      })
    )
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars);

  if (options?.levelColor) {
    body.setOverrides(setLevelColorOverrides);
  }
  const build: VizPanel<Options> = body.build();

  return new SceneFlexItem({
    key: VALUE_SUMMARY_PANEL_KEY,
    minHeight: getValueSummaryHeight(collapsable),
    height: getValueSummaryHeight(collapsable),
    maxHeight: getValueSummaryHeight(collapsable),

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
  return collapsableState === CollapsablePanelType.collapse ? 300 : 35;
}

export const VALUE_SUMMARY_PANEL_KEY = 'value_summary_panel';
