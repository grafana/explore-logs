import { DataFrame, GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import {
  SceneComponentProps,
  SceneCSSGridItem,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  VizPanelMenu,
} from '@grafana/scenes';
import React from 'react';
import { css } from '@emotion/css';
import { onExploreLinkClick } from '../ServiceScene/GoToExploreButton';
import { IndexScene } from '../IndexScene/IndexScene';
import { getQueryRunnerFromChildren } from '../../services/scenes';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { logger } from '../../services/logger';
import { AddToExplorationButton } from '../ServiceScene/Breakdowns/AddToExplorationButton';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { ExtensionPoints } from '../../services/extensions/links';

const ADD_TO_INVESTIGATION_MENU_TEXT = 'Add to investigation';
const ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT = 'Add to investigation div';

interface ExploreLogsVizPanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;
  addToExplorations?: AddToExplorationButton;
}

/**
 * @todo the VizPanelMenu interface is overly restrictive, doesn't allow any member functions on this class, so everything is currently inlined
 */
export class ExploreLogsVizPanelMenu
  extends SceneObjectBase<ExploreLogsVizPanelMenuState>
  implements VizPanelMenu, SceneObject
{
  constructor(state: Partial<ExploreLogsVizPanelMenuState>) {
    super(state);
    this.addActivationHandler(() => {
      this.setState({
        addToExplorations: new AddToExplorationButton({
          labelName: this.state.labelName,
          fieldName: this.state.fieldName,
          frame: this.state.frame,
        }),
      });

      // @todo rewrite the AddToExplorationButton
      // Manually activate scene
      this.state.addToExplorations?.activate();

      const items: PanelMenuItem[] = [
        {
          text: 'Explore',
          iconClassName: 'compass',
          shortcut: '',
          onClick: () => onExploreClick(this),
        },
      ];

      this.setState({
        body: new VizPanelMenu({
          items,
        }),
      });

      this.state.addToExplorations?.subscribeToState(() => {
        subscribeToAddToExploration(this);
      });
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

  public static Component = ({ model }: SceneComponentProps<ExploreLogsVizPanelMenu>) => {
    const { body } = model.useState();

    if (body) {
      return body && <body.Component model={body} />;
    }

    return <></>;
  };
}

const onExploreClick = (sceneRef: SceneObject) => {
  const indexScene = sceneGraph.getAncestor(sceneRef, IndexScene);
  const $data = sceneGraph.getData(sceneRef);
  let queryRunner = getQueryRunnerFromChildren($data)[0];

  // If we don't have a query runner, then our panel is within a SceneCSSGridItem, we need to get the query runner from there
  if (!queryRunner) {
    const sceneGridItem = sceneGraph.getAncestor(sceneRef, SceneCSSGridItem);
    const queryProvider = sceneGraph.getData(sceneGridItem);

    if (queryProvider instanceof SceneQueryRunner) {
      queryRunner = queryProvider;
    } else {
      logger.error(new Error('query provider not found!'));
    }
  }
  const uninterpolatedExpr: string | undefined = queryRunner.state.queries[0].expr;
  const expr = sceneGraph.interpolate(sceneRef, uninterpolatedExpr);

  reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);

  onExploreLinkClick(indexScene, expr);
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

function subscribeToAddToExploration(exploreLogsVizPanelMenu: ExploreLogsVizPanelMenu) {
  const addToExplorationButton = exploreLogsVizPanelMenu.state.addToExplorations;
  if (addToExplorationButton) {
    const link = getInvestigationLink(addToExplorationButton);

    const existingMenuItems = exploreLogsVizPanelMenu.state.body?.state.items ?? [];

    const existingAddToExplorationLink = existingMenuItems.find((item) => item.text === ADD_TO_INVESTIGATION_MENU_TEXT);

    if (link) {
      if (!existingAddToExplorationLink) {
        exploreLogsVizPanelMenu.state.body?.addItem({
          text: ADD_TO_INVESTIGATION_MENU_DIVIDER_TEXT,
          shortcut: '',
          type: 'divider',
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
      display: 'flex',

      // @todo remove this wrapper and styles when core changes are introduced in ???
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
