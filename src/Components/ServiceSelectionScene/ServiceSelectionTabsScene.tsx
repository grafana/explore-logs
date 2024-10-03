import {
  QueryRunnerState,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
} from '@grafana/scenes';
import React, { useRef } from 'react';
import { Popover, PopoverController, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, IconName, LoadingState, SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { capitalizeFirstLetter } from '../../services/text';
import { rest } from 'lodash';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { getSceneQueryRunner } from '../../services/panel';
import { buildResourceQuery } from '../../services/query';
import { TabPopoverScene } from './TabPopoverScene';
import { getServiceSelectionPrimaryLabel } from '../../services/variableGetters';

export interface TabOption extends SelectableValue {
  label: string;
  value: string;
  icon?: IconName;
  active?: boolean;
  counter?: number;
  saved?: boolean;
}

export interface ServiceSelectionTabsSceneState extends SceneObjectState {
  tabOptions: TabOption[];
  showPopover: boolean;
  $labelsData: SceneQueryRunner;
  popover?: TabPopoverScene;
}

interface LabelOptions {
  label: string;
  cardinality: number;
}

export class ServiceSelectionTabsScene extends SceneObjectBase<ServiceSelectionTabsSceneState> {
  constructor(state: Partial<ServiceSelectionTabsSceneState>) {
    console.log('ServiceSelectionTabsScene constructor');
    super({
      showPopover: false,
      $labelsData: getSceneQueryRunner({
        queries: [buildResourceQuery('', 'detected_labels')],
        runQueriesMode: 'manual',
      }),
      tabOptions: [
        {
          label: SERVICE_UI_LABEL,
          value: SERVICE_NAME,
          saved: true,
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
    const primaryLabel = getServiceSelectionPrimaryLabel(model);
    // Re-render when active tab changes, which is stored in the primary label variable
    primaryLabel.useState();

    // Consts
    const styles = useStyles2(getTabsStyles);
    const popoverRef = useRef<HTMLElement>(null);

    console.log('tabOptions', tabOptions);

    return (
      <TabsBar>
        {tabOptions.map((tabLabel) => (
          <Tab
            key={tabLabel.value}
            onChangeTab={() => {
              // Set the new active tab
              serviceSelectionScene.setSelectedTab(tabLabel.value);
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

  toggleShowPopover = () => {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  };

  getLabelsFromQueryRunnerState(state: QueryRunnerState): LabelOptions[] | undefined {
    console.log('getLabelsFromQueryRunnerState', state);

    // const labels: string[] | undefined = state.data?.series?.[0].fields[0].values;
    return state.data?.series[0].fields.map((f) => {
      return {
        label: f.name,
        cardinality: f.values[0],
      };
    });
  }

  private onActivate() {
    // Get labels
    this.state.$labelsData.runQueries();

    this.setState({
      popover: new TabPopoverScene({}),
    });

    this._subs.add(
      getServiceSelectionPrimaryLabel(this).subscribeToState((newState, prevState) => {
        const labels = this.getLabelsFromQueryRunnerState(this.state.$labelsData.state);
        if (labels) {
          this.populatePrimaryLabelsVariableOptions(labels);
        }
      })
    );

    // Update labels/tabs on time range change
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.state.$labelsData.runQueries();
      })
    );

    this._subs.add(
      this.state.$labelsData.subscribeToState((newState, prevState) => {
        if (newState.data?.state === LoadingState.Done) {
          const labels = this.getLabelsFromQueryRunnerState(newState);
          if (labels) {
            this.populatePrimaryLabelsVariableOptions(labels);
          }
        }
      })
    );
  }

  private populatePrimaryLabelsVariableOptions(labels: LabelOptions[]) {
    const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);
    const selectedTab = serviceSelectionScene.getSelectedTab();
    const tabOptions: TabOption[] = labels
      .filter((l) => l.label !== '__stream_shard__' && l.label !== '__aggregated_metric__')
      .map((l) => {
        const option: TabOption = {
          label: l.label === SERVICE_NAME ? SERVICE_UI_LABEL : l.label,
          value: l.label,
          active: selectedTab === l.label,
          counter: l.cardinality,
        };
        return option;
      })
      .sort((a, b) => {
        if (a.active || b.active) {
          return a.active === b.active ? 0 : a.active ? -1 : 1;
        }
        return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
      });
    this.setState({
      tabOptions,
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
