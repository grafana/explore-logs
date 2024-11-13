import { GrafanaTheme2, PanelMenuItem } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanelMenu } from '@grafana/scenes';
import React from 'react';
import { css } from '@emotion/css';

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
            { text: 'Explore', iconClassName: 'compass', shortcut: '' },
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
