import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import React, { useRef } from 'react';
import { Popover, PopoverController, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { css } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { capitalizeFirstLetter } from '../../services/text';
import { rest } from 'lodash';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { getSceneQueryRunner } from '../../services/panel';
import { buildResourceQuery } from '../../services/query';
import { TabPopoverScene } from './TabPopoverScene';

interface TabOption {
  label: string;
  value: string;
}

export interface ServiceSelectionTabsSceneState extends SceneObjectState {
  tabOptions: TabOption[];
  showPopover: boolean;
  $labelsData: SceneQueryRunner;
  popover?: TabPopoverScene;
}

export class ServiceSelectionTabsScene extends SceneObjectBase<ServiceSelectionTabsSceneState> {
  constructor(state: Partial<ServiceSelectionTabsSceneState>) {
    console.log('ServiceSelectionTabsScene constructor');
    super({
      showPopover: false,
      $labelsData: getSceneQueryRunner({
        queries: [buildResourceQuery('', 'labels')],
        runQueriesMode: 'manual',
      }),
      tabOptions: [
        {
          label: SERVICE_UI_LABEL,
          value: SERVICE_NAME,
        },
      ],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionTabsScene>) => {
    // Scene vars
    const { tabOptions, showPopover, popover } = model.useState();
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const { selectedTab } = serviceSelectionScene.useState();

    // Consts
    const styles = useStyles2(getTabsStyles);
    const popoverRef = useRef<HTMLElement>(null);

    // Things that should be refactored into class methods
    const tabLabels: Array<{ label: string; value: string; counter?: number; active: boolean }> = [
      ...tabOptions.map((opt) => {
        return {
          value: opt.value.toString(),
          label: opt.label,
          active: selectedTab === opt.value,
          counter: undefined,
        };
      }),
    ].sort((a, b) => {
      return a === b ? 0 : a ? -1 : 1;
    });

    return (
      <TabsBar>
        {tabLabels.map((tabLabel) => (
          <Tab
            key={tabLabel.value}
            onChangeTab={() => {
              // Set the new active tab
              serviceSelectionScene.setTab(tabLabel.value);
            }}
            label={capitalizeFirstLetter(tabLabel.label)}
            active={tabLabel.active}
            counter={tabLabel.counter}
          />
        ))}
        {/* Add more tabs tab */}
        <Tab
          autoFocus={false}
          onChangeTab={model.toggleShowPopover}
          label={'Manage tabs'}
          ref={popoverRef}
          icon={'plus-circle'}
        />

        {popover && (
          <PopoverController content={<popover.Component model={popover} />}>
            {(showPopper, hidePopper, popperProps) => {
              const blurFocusProps = {
                onBlur: hidePopper,
                onFocus: showPopper,
              };

              return (
                <>
                  {popoverRef.current && (
                    <>
                      {/* @ts-expect-error @todo upgrade typescript */}
                      <Popover
                        {...popperProps}
                        {...rest}
                        show={showPopover}
                        wrapperClassName={styles.popover}
                        referenceElement={popoverRef.current}
                        renderArrow={true}
                        {...blurFocusProps}
                      />
                    </>
                  )}
                </>
              );
            }}
          </PopoverController>
        )}
      </TabsBar>
    );
  };

  public toggleShowPopover = () => {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  };

  private onActivate() {
    // Get labels
    this.state.$labelsData.runQueries();

    this.setState({
      popover: new TabPopoverScene({}),
    });

    // Update labels/tabs on time range change
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.state.$labelsData.runQueries();
      })
    );

    this._subs.add(
      this.state.$labelsData.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          const labels: string[] = newState.data?.series?.[0].fields[0].values;
          this.populatePrimaryLabelsVariableOptions(labels);
        }
      })
    );
  }

  private populatePrimaryLabelsVariableOptions(labels: string[]) {
    this.setState({
      tabOptions: labels
        .filter((l) => l !== '__stream_shard__' && l !== '__aggregated_metric__')
        .map((l) => {
          return {
            label: l === SERVICE_NAME ? SERVICE_UI_LABEL : l,
            value: l,
          };
        }),
    });
  }
}

const getTabsStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
});
