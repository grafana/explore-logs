import { DataFrame, GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanel,
  VizPanelMenu,
} from '@grafana/scenes';
import React from 'react';
import { onExploreLinkClick } from '../ServiceScene/GoToExploreButton';
import { IndexScene } from '../IndexScene/IndexScene';
import { findObjectOfType, getQueryRunnerFromChildren } from '../../services/scenes';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { logger } from '../../services/logger';
import { AddToExplorationButton } from '../ServiceScene/Breakdowns/AddToExplorationButton';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { ExtensionPoints } from '../../services/extensions/links';
import { setLevelColorOverrides } from '../../services/panel';
import { setPanelOption } from '../../services/store';
import { FieldsAggregatedBreakdownScene } from '../ServiceScene/Breakdowns/FieldsAggregatedBreakdownScene';
import { setValueSummaryHeight } from '../ServiceScene/Breakdowns/Panels/ValueSummary';
import { FieldValuesBreakdownScene } from '../ServiceScene/Breakdowns/FieldValuesBreakdownScene';
import { LabelValuesBreakdownScene } from '../ServiceScene/Breakdowns/LabelValuesBreakdownScene';
import { css } from '@emotion/css';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'Investigations';

export enum AvgFieldPanelType {
  'timeseries' = 'timeseries',
  'histogram' = 'histogram',
}

export enum CollapsablePanelText {
  collapsed = 'Collapse',
  expanded = 'Expand',
}

interface PanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
  addExplorationsLink?: boolean;
  explorationsButton?: AddToExplorationButton;
  panelType?: AvgFieldPanelType;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class PanelMenu extends SceneObjectBase<PanelMenuState> implements VizPanelMenu, SceneObject {
  constructor(state: Partial<PanelMenuState>) {
    super({ ...state, addExplorationsLink: state.addExplorationsLink ?? true });
    this.addActivationHandler(() => {
      const viz = findObjectOfType(this, (o) => o instanceof VizPanel, VizPanel);

      this.setState({
        explorationsButton: new AddToExplorationButton({
          labelName: this.state.labelName,
          fieldName: this.state.fieldName,
          frame: this.state.frame,
        }),
      });

      if (this.state.addExplorationsLink) {
        // @todo rewrite the AddToExplorationButton
        // Manually activate scene
        this.state.explorationsButton?.activate();
      }

      // Navigation options (all panels)
      const items: PanelMenuItem[] = [
        {
          text: 'Navigation',
          type: 'group',
        },
        {
          text: 'Explore',
          iconClassName: 'compass',
          href: getExploreLink(this),
          onClick: () => onExploreLinkClickTracking(),
          shortcut: 'p x',
        },
      ];

      // Visualization options
      if (this.state.panelType || viz?.state.collapsible) {
        addVisualizationHeader(items, this);
      }

      if (viz?.state.collapsible) {
        addCollapsableItem(items, this);
      }

      if (this.state.panelType) {
        addHistogramItem(items, this);
      }

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

      this._subs.add(
        this.state.explorationsButton?.subscribeToState(() => {
          subscribeToAddToExploration(this);
        })
      );
    });
  }

  addItem(item: PanelMenuItem): void {
    if (this.state.body) {
      this.state.body.addItem(item);
    }
  }
  setItems(items: PanelMenuItem[]): void {
    if (this.state.body) {
      this.state.body.setItems(items);
    }
  }

  public static Component = ({ model }: SceneComponentProps<PanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return <body.Component model={body} />;
    }

    return <></>;
  };
}

function addVisualizationHeader(items: PanelMenuItem[], sceneRef: PanelMenu) {
  items.push({
    text: '',
    type: 'divider',
  });
  items.push({
    text: 'Visualization',
    type: 'group',
  });
}

function addCollapsableItem(items: PanelMenuItem[], menu: PanelMenu) {
  const viz = sceneGraph.getAncestor(menu, VizPanel);
  items.push({
    text: viz.state.collapsed ? CollapsablePanelText.expanded : CollapsablePanelText.collapsed,
    iconClassName: viz.state.collapsed ? 'table-collapse-all' : 'table-expand-all',
    onClick: () => {
      const newCollapsableState = viz.state.collapsed ? CollapsablePanelText.expanded : CollapsablePanelText.collapsed;

      // Update the viz
      const vizPanelFlexLayout = sceneGraph.getAncestor(menu, SceneFlexLayout);
      setValueSummaryHeight(vizPanelFlexLayout, newCollapsableState);

      // Set state and update local storage
      viz.setState({
        collapsed: !viz.state.collapsed,
      });
      setPanelOption('collapsed', newCollapsableState);
    },
  });
}

function addHistogramItem(items: PanelMenuItem[], sceneRef: PanelMenu) {
  items.push({
    text: sceneRef.state.panelType !== AvgFieldPanelType.histogram ? 'Histogram' : 'Time series',
    iconClassName: sceneRef.state.panelType !== AvgFieldPanelType.histogram ? 'graph-bar' : 'chart-line',

    onClick: () => {
      const gridItem = sceneGraph.getAncestor(sceneRef, SceneCSSGridItem);
      const viz = sceneGraph.getAncestor(sceneRef, VizPanel).clone();
      const $data = sceneGraph.getData(sceneRef).clone();
      const menu = sceneRef.clone();
      const headerActions = Array.isArray(viz.state.headerActions)
        ? viz.state.headerActions.map((o) => o.clone())
        : viz.state.headerActions;
      let body;

      if (sceneRef.state.panelType !== AvgFieldPanelType.histogram) {
        body = PanelBuilders.timeseries().setOverrides(setLevelColorOverrides);
      } else {
        body = PanelBuilders.histogram();
      }

      gridItem.setState({
        body: body.setMenu(menu).setTitle(viz.state.title).setHeaderActions(headerActions).setData($data).build(),
      });

      const newPanelType =
        sceneRef.state.panelType !== AvgFieldPanelType.timeseries
          ? AvgFieldPanelType.timeseries
          : AvgFieldPanelType.histogram;
      setPanelOption('panelType', newPanelType);
      menu.setState({ panelType: newPanelType });

      const fieldsAggregatedBreakdownScene = findObjectOfType(
        gridItem,
        (o) => o instanceof FieldsAggregatedBreakdownScene,
        FieldsAggregatedBreakdownScene
      );
      if (fieldsAggregatedBreakdownScene) {
        fieldsAggregatedBreakdownScene.rebuildAvgFields();
      }

      onSwitchVizTypeTracking(newPanelType);
    },
  });
}

export const getExploreLink = (sceneRef: SceneObject) => {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const $data = sceneGraph.getData(sceneRef);
  let queryRunner = $data instanceof SceneQueryRunner ? $data : getQueryRunnerFromChildren($data)[0];

  // If we don't have a query runner, then our panel is within a SceneCSSGridItem, we need to get the query runner from there
  if (!queryRunner) {
    const breakdownScene = sceneGraph.findObject(
      sceneRef,
      (o) => o instanceof FieldValuesBreakdownScene || o instanceof LabelValuesBreakdownScene
    );
    if (breakdownScene) {
      const queryProvider = sceneGraph.getData(breakdownScene);

      if (queryProvider instanceof SceneQueryRunner) {
        queryRunner = queryProvider;
      } else {
        queryRunner = getQueryRunnerFromChildren(queryProvider)[0];
      }
    } else {
      logger.error(new Error('Unable to locate query runner!'), {
        msg: 'PanelMenu - getExploreLink: Unable to locate query runner!',
      });
    }
  }
  const uninterpolatedExpr: string | undefined = queryRunner.state.queries[0].expr;
  const expr = sceneGraph.interpolate(sceneRef, uninterpolatedExpr);

  return onExploreLinkClick(indexScene, expr);
};

const onExploreLinkClickTracking = () => {
  reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);
};

const onSwitchVizTypeTracking = (newVizType: AvgFieldPanelType) => {
  reportAppInteraction(USER_EVENTS_PAGES.service_details, USER_EVENTS_ACTIONS.service_details.change_viz_type, {
    newVizType,
  });
};

const getInvestigationLink = (addToExplorations: AddToExplorationButton) => {
  const links = getPluginLinkExtensions({
    extensionPointId: ExtensionPoints.MetricExploration,
    context: addToExplorations.state.context,
  });

  return links.extensions[0];
};

const onAddToInvestigationClick = (event: React.MouseEvent, addToExplorations: AddToExplorationButton) => {
  const link = getInvestigationLink(addToExplorations);
  if (link && link.onClick) {
    link.onClick(event);
  }
};

function subscribeToAddToExploration(exploreLogsVizPanelMenu: PanelMenu) {
  const addToExplorationButton = exploreLogsVizPanelMenu.state.explorationsButton;
  if (addToExplorationButton) {
    const link = getInvestigationLink(addToExplorationButton);

    const existingMenuItems = exploreLogsVizPanelMenu.state.body?.state.items ?? [];

    const existingAddToExplorationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToExplorationLink) {
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'divider',
        });
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          type: 'group',
        });
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_TEXT,
          iconClassName: 'plus-square',
          onClick: (e) => onAddToInvestigationClick(e, addToExplorationButton),
        });
      } else {
        if (existingAddToExplorationLink) {
          exploreLogsVizPanelMenu.state.body?.setItems(
            existingMenuItems.filter(
              (item) =>
                item.text !== ADD_TO_INVESTIGATION_MENU_TEXT && item.text !== ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT
            )
          );
        }
      }
    }
  }
}

export const getPanelWrapperStyles = (theme: GrafanaTheme2) => {
  return {
    panelWrapper: css({
      width: '100%',
      height: '100%',
      label: 'panel-wrapper',
      position: 'absolute',
      display: 'flex',

      // @todo remove this wrapper and styles when core changes are introduced in 11.5
      // Need more specificity to override core style
      'button.show-on-hover': {
        opacity: 1,
        visibility: 'visible',
        background: 'none',
        '&:hover': {
          background: theme.colors.secondary.shade,
        },
      },
    }),
  };
};
