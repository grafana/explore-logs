import { GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import {
  SceneComponentProps,
  SceneCSSGridItem,
  sceneGraph,
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

interface ExploreLogsVizPanelMenuState extends SceneObjectState {
  body?: VizPanelMenu;
}

export class ExploreLogsVizPanelMenu extends SceneObjectBase<ExploreLogsVizPanelMenuState> implements VizPanelMenu {
  constructor(state: Partial<ExploreLogsVizPanelMenuState>) {
    super(state);
    this.addActivationHandler(() => {
      this.setState({
        body: new VizPanelMenu({
          items: [
            {
              text: 'Explore',
              iconClassName: 'compass',
              shortcut: '',
              onClick: () => {
                const indexScene = sceneGraph.getAncestor(this, IndexScene);
                const $data = sceneGraph.getData(this);
                let queryRunner = getQueryRunnerFromChildren($data)[0];

                // If we don't have a query runner, then our panel is within a SceneCSSGridItem, we need to get the query runner from there
                if (!queryRunner) {
                  const sceneGridItem = sceneGraph.getAncestor(this, SceneCSSGridItem);
                  const queryProvider = sceneGraph.getData(sceneGridItem);

                  if (queryProvider instanceof SceneQueryRunner) {
                    queryRunner = queryProvider;
                  } else {
                    logger.error(new Error('query provider not found!'));
                  }
                }
                const uninterpolatedExpr: string | undefined = queryRunner.state.queries[0].expr;
                const expr = sceneGraph.interpolate(this, uninterpolatedExpr);

                reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);

                onExploreLinkClick(indexScene, expr);
              },
            },
            { text: 'Add to Dashboard', iconClassName: 'compass', shortcut: '' },
            { text: '', iconClassName: 'compass', shortcut: '', type: 'divider' },
            { text: 'Add to investigation', iconClassName: 'plus-square' },
          ],
        }),
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

export const getPanelWrapperStyles = (theme: GrafanaTheme2) => {
  return {
    panelWrapper: css({
      width: '100%',
      height: '100%',
      label: 'panel-wrapper',
      display: 'flex',

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
