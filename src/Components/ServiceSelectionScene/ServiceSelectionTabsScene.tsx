import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import React, { useRef } from 'react';
import { Icon, Popover, PopoverController, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, LoadingState, SelectableValue } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { capitalizeFirstLetter } from '../../services/text';
import { rest } from 'lodash';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { getSceneQueryRunner } from '../../services/panel';
import { buildResourceQuery } from '../../services/query';
import { TabPopoverScene } from './TabPopoverScene';
import { getDataSourceVariable, getServiceSelectionPrimaryLabel } from '../../services/variableGetters';
import { getFavoriteTabsFromStorage, removeTabFromLocalStorage } from '../../services/store';

export interface TabOption extends SelectableValue<string> {
  label: string;
  value: string;
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
    const { tabOptions, showPopover, popover, $labelsData } = model.useState();
    const { data } = $labelsData.useState();
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const primaryLabel = getServiceSelectionPrimaryLabel(model);
    // Re-render when active tab changes, which is stored in the primary label variable
    primaryLabel.useState();

    // Constants
    const styles = useStyles2(getTabsStyles);
    const popoverRef = useRef<HTMLElement>(null);

    return (
      <TabsBar>
        {tabOptions
          .filter((tabLabel) => tabLabel.saved || tabLabel.active || tabLabel.value === SERVICE_NAME)
          .map((tabLabel) => (
            <Tab
              key={tabLabel.value}
              title={tabLabel.value}
              onChangeTab={() => {
                // Set the new active tab
                serviceSelectionScene.setSelectedTab(tabLabel.value);
              }}
              label={capitalizeFirstLetter(tabLabel.label)}
              active={tabLabel.active}
              counter={tabLabel.counter}
              suffix={
                tabLabel.value !== SERVICE_NAME
                  ? (props) => {
                      return (
                        <Icon
                          onClick={(e) => {
                            // Don't bubble up to the tab component, we don't want to select the tab we're removing
                            e.stopPropagation();
                            model.removeSavedTab(tabLabel.value);
                          }}
                          name={'times-circle'}
                          size={'lg'}
                          className={cx(props.className, styles.closeIcon)}
                        />
                      );
                    }
                  : undefined
              }
            />
          ))}
        {data?.state === LoadingState.Loading && <Tab label={'Loading tabs'} icon={'spinner'} />}

        {/* Add more tabs tab */}
        {data?.state === LoadingState.Done && (
          <Tab
            autoFocus={false}
            onChangeTab={model.toggleShowPopover}
            label={'Add tabs'}
            ref={popoverRef}
            icon={'plus-circle'}
          />
        )}

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

  removeSavedTab = (labelName: string) => {
    removeTabFromLocalStorage(getDataSourceVariable(this).getValue().toString(), labelName);

    const labels = this.getLabelsFromQueryRunnerState();
    if (labels) {
      this.populatePrimaryLabelsVariableOptions(labels);
    }

    // If the user is closing the active tab, select the default tab
    const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);
    if (serviceSelectionScene.getSelectedTab() === labelName) {
      serviceSelectionScene.selectDefaultLabelTab();
    }
  };

  toggleShowPopover = () => {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  };

  getLabelsFromQueryRunnerState(state = this.state.$labelsData?.state): LabelOptions[] | undefined {
    return state.data?.series[0].fields.map((f) => {
      return {
        label: f.name,
        cardinality: f.values[0],
      };
    });
  }

  public populatePrimaryLabelsVariableOptions(labels: LabelOptions[]) {
    const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);
    const selectedTab = serviceSelectionScene.getSelectedTab();
    const savedTabs = getFavoriteTabsFromStorage(getDataSourceVariable(this).getValue().toString());
    const tabOptions: TabOption[] = labels
      .filter((l) => l.label !== '__stream_shard__' && l.label !== '__aggregated_metric__')
      .map((l) => {
        const option: TabOption = {
          label: l.label === SERVICE_NAME ? SERVICE_UI_LABEL : l.label,
          value: l.label,
          active: selectedTab === l.label,
          counter: l.cardinality,
          saved: savedTabs.includes(l.label),
        };
        return option;
      })
      .sort((a, b) => {
        // Sort service first
        if (a.value === SERVICE_NAME || b.value === SERVICE_NAME) {
          return a.value === SERVICE_NAME ? -1 : 1;
        }

        // if(a.saved || b.saved && !(a.saved && b.saved)){
        //   return (a.saved ? 1 : 0) > (b.saved ? 1 : 0) ? -1 : 1
        // }

        // Then sort alphabetically
        return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
      });
    this.setState({
      tabOptions,
    });
  }

  private onActivate() {
    // Get labels
    this.state.$labelsData.runQueries();

    this.setState({
      popover: new TabPopoverScene({}),
    });

    // Update labels (tabs) when datasource is changed
    this._subs.add(
      getDataSourceVariable(this).subscribeToState(() => {
        this.state.$labelsData.runQueries();
      })
    );

    this._subs.add(
      getServiceSelectionPrimaryLabel(this).subscribeToState(() => {
        const labels = this.getLabelsFromQueryRunnerState(this.state.$labelsData?.state);
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
      this.state.$labelsData.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          const labels = this.getLabelsFromQueryRunnerState(newState);
          const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);

          if (labels) {
            this.populatePrimaryLabelsVariableOptions(labels);
          }

          const selectedTab = serviceSelectionScene.getSelectedTab();
          // If the tab is no longer available, either because the user changed the datasource, or time range, select the default tab
          if (!labels?.some((label) => label.label === selectedTab)) {
            serviceSelectionScene.selectDefaultLabelTab();
          }
        }
      })
    );
  }
}

const getTabsStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  closeIcon: css({
    '&:hover': {
      fill: 'red', // @todo JOAN
    },
  }),
});
