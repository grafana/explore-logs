import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Box, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { getExplorationFor } from '../../services/scenes';
import { getDrilldownSlug, getDrilldownValueSlug, PageSlugs, ValueSlugs } from '../../services/routing';
import { GoToExploreButton } from './GoToExploreButton';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getLabelsVariable, SERVICE_NAME } from '../../services/variables';
import { navigateToDrilldownPage, navigateToIndex } from '../../services/navigate';
import React from 'react';
import { ServiceScene, ServiceSceneState } from './ServiceScene';
import { GrafanaTheme2 } from '@grafana/data';
import { css } from '@emotion/css';
import { BreakdownViewDefinition, breakdownViewsDefinitions } from './BreakdownViews';

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
                    const variable = getLabelsVariable(serviceScene);
                    const service = variable.state.filters.find((f) => f.key === SERVICE_NAME);

                    if (service?.value) {
                      navigateToDrilldownPage(tab.value, serviceScene);
                    } else {
                      navigateToIndex();
                    }
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
