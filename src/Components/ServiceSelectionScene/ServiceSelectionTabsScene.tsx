import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import React, { useRef } from 'react';
import { Popover, PopoverController, Select, Stack, Tab, TabsBar, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, LoadingState } from '@grafana/data';
import { css } from '@emotion/css';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { getServiceSelectionPrimaryLabel, getServiceSelectionSearchVariable } from '../../services/variableGetters';
import { capitalizeFirstLetter } from '../../services/text';
import { rest } from 'lodash';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { getSceneQueryRunner } from '../../services/panel';
import { buildResourceQuery } from '../../services/query';

interface TabOption {
  label: string;
  value: string;
}

export interface ServiceSelectionTabsSceneState extends SceneObjectState {
  tabOptions: TabOption[];
  showPopover: boolean;
  $labelsData: SceneQueryRunner;
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
    const { tabOptions, showPopover } = model.useState();
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const { $data, selectedTab } = serviceSelectionScene.useState();

    // Consts
    const popoverStyles = useStyles2(getPopoverStyles);
    const primaryLabel = getServiceSelectionPrimaryLabel(model);
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

    // Things that should be new scenes
    const popoverContent = (
      <Stack direction="column" gap={0} role="tooltip">
        <div className={popoverStyles.card.body}>
          <Select
            placeholder={'Search labels'}
            options={model.state.tabOptions}
            isSearchable={true}
            onChange={(opt) => {
              // Hide the popover
              model.toggleShowPopover();

              // clear search
              const searchVar = getServiceSelectionSearchVariable(model);
              searchVar.setState({
                value: '.+',
                label: '',
              });

              // Add value to variable
              if (opt.value) {
                // Add tab
                serviceSelectionScene.setState({
                  selectedTab: opt.value,
                });
                primaryLabel.setState({
                  filters: [
                    {
                      value: '.+',
                      operator: '=~',
                      key: opt.value,
                    },
                  ],
                });

                // primaryLabel.changeValueTo(opt.value.toString())

                // Update volume query
                // const serviceLabelVar = getServiceLabelVariable(model);
                // serviceLabelVar.changeValueTo(opt.value.toString())
                $data.runQueries();
              }
            }}
          />
        </div>
      </Stack>
    );

    return (
      <TabsBar>
        {tabLabels.map((tabLabel) => (
          <Tab
            key={tabLabel.value}
            onChangeTab={() => {
              // clear search on previous label
              const searchVar = getServiceSelectionSearchVariable(model);
              searchVar.setState({
                value: '.+',
                label: '',
              });
              serviceSelectionScene.setState({
                selectedTab: tabLabel.value,
              });
              primaryLabel.setState({
                filters: [
                  {
                    value: '.+',
                    key: tabLabel.value,
                    operator: '=~',
                  },
                ],
              });
            }}
            label={capitalizeFirstLetter(tabLabel.label)}
            active={tabLabel.active}
            counter={tabLabel.counter}
          />
        ))}
        {/* Add more tabs tab */}
        <Tab onChangeTab={model.toggleShowPopover} label={''} ref={popoverRef} icon={'plus-circle'} />

        <PopoverController content={popoverContent}>
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
                      wrapperClassName={popoverStyles.popover}
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

const getPopoverStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
  }),
  card: {
    body: css({
      padding: theme.spacing(1),
    }),
    header: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderBottom: `solid 1px ${theme.colors.border.medium}`,
    }),
    footer: css({
      padding: theme.spacing(0.5, 1),
      background: theme.colors.background.secondary,
      borderTop: `solid 1px ${theme.colors.border.medium}`,
    }),
  },
});
