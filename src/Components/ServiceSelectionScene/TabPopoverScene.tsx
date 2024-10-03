import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Select, Stack, useStyles2 } from '@grafana/ui';
import React from 'react';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { ServiceSelectionTabsScene } from './ServiceSelectionTabsScene';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';

export interface TabPopoverSceneState extends SceneObjectState {}

export class TabPopoverScene extends SceneObjectBase<TabPopoverSceneState> {
  public static Component = ({ model }: SceneComponentProps<TabPopoverScene>) => {
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const serviceSelectionTabsScene = sceneGraph.getAncestor(model, ServiceSelectionTabsScene);
    const { tabOptions, showPopover } = serviceSelectionTabsScene.useState();
    const popoverStyles = useStyles2(getPopoverStyles);

    return (
      <Stack direction="column" gap={0} role="tooltip">
        <div className={popoverStyles.card.body}>
          <Select
            menuShouldPortal={false}
            onBlur={() => {
              serviceSelectionTabsScene.toggleShowPopover();
            }}
            autoFocus={true}
            isOpen={showPopover}
            placeholder={'Search labels'}
            options={tabOptions}
            isSearchable={true}
            openMenuOnFocus={true}
            onChange={(option) => {
              // Hide the popover
              serviceSelectionTabsScene.toggleShowPopover();

              // Add value to variable
              if (option.value) {
                // Set new tab
                serviceSelectionScene.setTab(option.value);
              }
            }}
          />
        </div>
      </Stack>
    );
  };
}

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  card: {
    body: css({
      padding: theme.spacing(1),
    }),
  },
});
