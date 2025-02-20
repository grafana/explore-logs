import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneDataProvider,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { CollapsablePanelText, PanelMenu } from '../../../Panels/PanelMenu';
import { DrawStyle, PanelContext, SeriesVisibilityChangeMode, StackingMode } from '@grafana/ui';
import {
  setLevelColorOverrides,
  syncFieldsValueSummaryVisibleSeries,
  syncLabelsValueSummaryVisibleSeries,
  syncLevelsVisibleSeries,
} from '../../../../services/panel';
import { getPanelOption, setPanelOption } from '../../../../services/store';
import React from 'react';
import {
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getMetadataVariable,
} from '../../../../services/variableGetters';
import { toggleLevelFromFilter } from '../../../../services/levels';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../../../services/analytics';
import { DataFrame, LoadingState } from '@grafana/data';
import { LEVEL_VARIABLE_VALUE } from '../../../../services/variables';
import { logger } from '../../../../services/logger';
import { FilterType } from '../AddToFiltersButton';
import { toggleFieldFromFilter, toggleLabelFromFilter } from '../../../../services/labels';

const SUMMARY_PANEL_SERIES_LIMIT = 100;

interface ValueSummaryPanelSceneState extends SceneObjectState {
  body?: SceneFlexLayout;
  title: string;
  levelColor?: boolean;
  tagKey: string;
  type: 'field' | 'label';
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

  /**
   * Syncs legend with labels
   */
  private extendTimeSeriesLegendBus = (context: PanelContext) => {
    const $data = sceneGraph.getData(this);
    const dataFrame = $data.state.data?.series;
    const key = this.state.tagKey;

    const sceneFlexItem = this.state.body?.state.children[0];
    if (!(sceneFlexItem instanceof SceneFlexItem)) {
      throw new Error('Cannot find sceneFlexItem');
    }
    const panel = sceneFlexItem.state.body;

    if (!(panel instanceof VizPanel)) {
      throw new Error('Cannot find VizPanel');
    }

    this.initLegendOptions(dataFrame, key, panel);

    if (this.state.type === 'label') {
      this._subs.add(this.getLabelsVariableLegendSyncSubscription(key));
    } else {
      this._subs.add(this.getFieldsVariableLegendSyncSubscription(key, getFieldsVariable(this)));
      this._subs.add(this.getFieldsVariableLegendSyncSubscription(key, getMetadataVariable(this)));
    }

    this._subs.add(this.getQuerySubscription(key, $data, panel));

    context.onToggleSeriesVisibility = (value: string, mode: SeriesVisibilityChangeMode) => {
      let action: FilterType;
      if (this.state.type === 'label') {
        if (key === LEVEL_VARIABLE_VALUE) {
          action = toggleLevelFromFilter(value, this);
        } else {
          action = toggleLabelFromFilter(key, value, this);
        }
      } else {
        action = toggleFieldFromFilter(key, value, this);
      }

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.label_in_panel_summary_clicked,
        {
          label: value,
          action,
        }
      );
    };
  };

  /**
   * Sync legend with current dataframe
   */
  private initLegendOptions(dataFrame: DataFrame[] | undefined, key: string, panel: VizPanel<{}, {}>) {
    if (dataFrame) {
      if (this.state.type === 'label') {
        if (key === LEVEL_VARIABLE_VALUE) {
          syncLevelsVisibleSeries(panel, dataFrame, this);
        } else {
          syncLabelsValueSummaryVisibleSeries(key, panel, dataFrame, this);
        }
      } else {
        syncFieldsValueSummaryVisibleSeries(key, panel, dataFrame, this);
      }
    }
  }

  /**
   * Sync visible series on dataframe update
   */
  private getQuerySubscription(key: string, $data: SceneDataProvider, panel: VizPanel<{}, {}>) {
    return $data.subscribeToState((newState, prevState) => {
      if (newState.data?.state === LoadingState.Done) {
        if (this.state.type === 'label') {
          if (key === LEVEL_VARIABLE_VALUE) {
            syncLevelsVisibleSeries(panel, newState.data.series, this);
          } else {
            syncLabelsValueSummaryVisibleSeries(key, panel, newState.data.series, this);
          }
        } else {
          syncFieldsValueSummaryVisibleSeries(key, panel, newState.data.series, this);
        }
      }
    });
  }

  private getFieldsVariableLegendSyncSubscription(key: string, variable: AdHocFiltersVariable) {
    return variable?.subscribeToState(() => {
      const sceneFlexItem = this.state.body?.state.children[0];
      if (!(sceneFlexItem instanceof SceneFlexItem)) {
        throw new Error('Cannot find sceneFlexItem');
      }
      const panel = sceneFlexItem.state.body;
      if (!(panel instanceof VizPanel)) {
        throw new Error('ValueSummary - getFieldsVariableLegendSyncSubscription: Cannot find VizPanel');
      }

      const $data = sceneGraph.getData(this);
      const dataFrame = $data.state.data?.series;

      if (!dataFrame) {
        logger.warn('ValueSummary - getFieldsVariableLegendSyncSubscription: missing dataframe!');
        return;
      }

      syncFieldsValueSummaryVisibleSeries(key, panel, dataFrame, this);
    });
  }

  /**
   * Returns value subscription for labels
   */
  private getLabelsVariableLegendSyncSubscription(key: string) {
    const isLevel = key === LEVEL_VARIABLE_VALUE;
    const variable = isLevel ? getLevelsVariable(this) : getLabelsVariable(this);
    return variable?.subscribeToState(() => {
      const sceneFlexItem = this.state.body?.state.children[0];
      if (!(sceneFlexItem instanceof SceneFlexItem)) {
        throw new Error('Cannot find sceneFlexItem');
      }
      const panel = sceneFlexItem.state.body;
      if (!(panel instanceof VizPanel)) {
        throw new Error('ValueSummary - getLabelsVariableLegendSyncSubscription: Cannot find VizPanel');
      }

      const $data = sceneGraph.getData(this);
      const dataFrame = $data.state.data?.series;

      if (!dataFrame) {
        logger.warn('ValueSummary - getLabelsVariableLegendSyncSubscription: missing dataframe!');
        return;
      }

      if (isLevel) {
        syncLevelsVisibleSeries(panel, dataFrame, this);
      } else {
        syncLabelsValueSummaryVisibleSeries(key, panel, dataFrame, this);
      }
    });
  }
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
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    // 11.5
    // .setShowMenuAlways(true)
    .setSeriesLimit(SUMMARY_PANEL_SERIES_LIMIT);

  if (options?.levelColor) {
    body.setOverrides(setLevelColorOverrides);
  }
  return body.build();
}

export const VALUE_SUMMARY_PANEL_KEY = 'value_summary_panel';
