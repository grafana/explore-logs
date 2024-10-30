import { SceneComponentProps, sceneGraph, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Dropdown, Menu, Stack, Tab, TabsBar, ToolbarButton, useStyles2 } from '@grafana/ui';
import { getExplorationFor } from '../../services/scenes';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, ValueSlugs } from '../../services/routing';
import { GoToExploreButton } from './GoToExploreButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { navigateToDrilldownPage } from '../../services/navigate';
import React, { useEffect, useState } from 'react';
import { ServiceScene, ServiceSceneState } from './ServiceScene';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { BreakdownViewDefinition, breakdownViewsDefinitions } from './BreakdownViews';
import { config, usePluginLinks } from '@grafana/runtime';
import { getLabelsVariable } from '../../services/variableGetters';

export interface ActionBarSceneState extends SceneObjectState {}

export class ActionBarScene extends SceneObjectBase<ActionBarSceneState> {
  public static Component = ({ model }: SceneComponentProps<ActionBarScene>) => {
    const styles = useStyles2(getStyles);
    const exploration = getExplorationFor(model);
    let currentBreakdownViewSlug = getDrilldownSlug();
    let allowNavToParent = false;

    if (!Object.values(PageSlugs).includes(currentBreakdownViewSlug)) {
      const drilldownValueSlug = getDrilldownValueSlug();
      allowNavToParent = true;
      if (drilldownValueSlug === ValueSlugs.field) {
        currentBreakdownViewSlug = PageSlugs.fields;
      }
      if (drilldownValueSlug === ValueSlugs.label) {
        currentBreakdownViewSlug = PageSlugs.labels;
      }
    }

    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
    const { loading, $data, ...state } = serviceScene.useState();
    const loadingStates = state.loadingStates;

    return (
      <Box paddingY={0}>
        <div className={styles.actions}>
          <Stack gap={1}>
            {
              // @ts-expect-error appSidecar not yet in stable runtime
              config.featureToggles.appSidecar && <ToolbarExtensionsRenderer serviceScene={serviceScene} />
            }
            <GoToExploreButton exploration={exploration} />
          </Stack>
        </div>

        <TabsBar>
          {breakdownViewsDefinitions.map((tab, index) => {
            return (
              <Tab
                data-testid={tab.testId}
                key={index}
                label={tab.displayName}
                active={currentBreakdownViewSlug === tab.value}
                counter={loadingStates[tab.displayName] ? undefined : getCounter(tab, { ...state, $data })}
                icon={loadingStates[tab.displayName] ? 'spinner' : undefined}
                onChangeTab={() => {
                  if ((tab.value && tab.value !== currentBreakdownViewSlug) || allowNavToParent) {
                    reportAppInteraction(
                      USER_EVENTS_PAGES.service_details,
                      USER_EVENTS_ACTIONS.service_details.action_view_changed,
                      {
                        newActionView: tab.value,
                        previousActionView: currentBreakdownViewSlug,
                      }
                    );

                    const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
                    navigateToDrilldownPage(tab.value, serviceScene);
                  }
                }}
              />
            );
          })}
        </TabsBar>
      </Box>
    );
  };
}
const getCounter = (tab: BreakdownViewDefinition, state: ServiceSceneState) => {
  switch (tab.value) {
    case 'fields':
      return state.fieldsCount;
    case 'patterns':
      return state.patternsCount;
    case 'labels':
      return state.labelsCount;
    default:
      return undefined;
  }
};

function getStyles(theme: GrafanaTheme2) {
  return {
    actions: css({
      [theme.breakpoints.up(theme.breakpoints.values.md)]: {
        position: 'absolute',
        right: 0,
        zIndex: 2,
      },
    }),
  };
}

/**
 * Shows extensions in the toolbar.
 * Shows a single button if there is only one extension or a dropdown if there are multiple.
 * @param props
 * @constructor
 */
function ToolbarExtensionsRenderer(props: { serviceScene: SceneObject }) {
  const [filters, setFilters] = useState<Array<{ key: string; value: string }>>(
    getLabelsVariable(props.serviceScene).state.filters
  );
  useEffect(() => {
    const sub = getLabelsVariable(props.serviceScene).subscribeToState((newState) => {
      setFilters(newState.filters);
    });
    return () => {
      sub.unsubscribe();
    };
  }, [props.serviceScene]);

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const extensions = usePluginLinks({
    extensionPointId: 'grafana-lokiexplore-app/toolbar',
    limitPerPlugin: 3,
    context: { filters },
  });

  if (extensions.isLoading || extensions.links.length === 0) {
    return null;
  }

  if (extensions.links.length === 1) {
    const e = extensions.links[0];

    return (
      <div>
        <ToolbarButton variant={'canvas'} key={e.id} onClick={(event) => e.onClick?.(event)} icon={e.icon}>
          Related {e.title}
        </ToolbarButton>
      </div>
    );
  }

  const menu = (
    <Menu>
      {extensions.links.map((link) => {
        return (
          <Menu.Item
            ariaLabel={link.title}
            icon={link?.icon || 'plug'}
            key={link.id}
            label={link.title}
            onClick={(event) => {
              link.onClick?.(event);
            }}
          />
        );
      })}
    </Menu>
  );

  return (
    <Dropdown onVisibleChange={setIsOpen} placement="bottom-start" overlay={menu}>
      <ToolbarButton aria-label="Open related" variant="canvas" isOpen={isOpen}>
        Open related
      </ToolbarButton>
    </Dropdown>
  );
}
