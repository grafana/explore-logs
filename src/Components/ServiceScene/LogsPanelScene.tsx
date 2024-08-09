import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneDataNode,
  SceneDataState,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { DataFrame, LoadingState } from '@grafana/data';
import {getLogsPanelFrame, ServiceScene} from './ServiceScene';
import { getLogOption } from '../../services/store';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import React from 'react';
import { LogsListScene } from './LogsListScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { getLabelTypeFromFrame, LabelType } from '../../services/fields';
import { getAdHocFiltersVariable, VAR_FIELDS, VAR_LABELS, VAR_LEVELS } from '../../services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { areArraysEqual } from '../../services/comparison';
import {Unsubscribable} from "rxjs";

interface LogsPanelSceneState extends SceneObjectState {
  data: SceneDataState;
  body?: VizPanel;
  dataSubscriber?: Unsubscribable
}

export class LogsPanelScene extends SceneObjectBase<LogsPanelSceneState> {
  constructor(state: Partial<LogsPanelSceneState> & { data: SceneDataState }) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    if (!this.state.body) {
      this.setState({
        body: this.getLogsPanel(),
      });
    }

    this.subscribeToDataProvider();

    const serviceScene = sceneGraph.getAncestor(this, ServiceScene)

    // subscribe to service scene data provider updates
    this._subs.add(
      serviceScene.subscribeToState((newState, prevState) => {
        if(newState.$data.state.key !== prevState.$data.state.key && newState.$data.state.key){
          this.state.dataSubscriber?.unsubscribe()
          this.subscribeToDataProvider();
        }
      })
    )

    return () => {
      console.log('deactivate logs panel scene', this)
      const sub = this.state.dataSubscriber

      if(sub){
        sub?.unsubscribe()
      }
      this._subs.remove(this._subs)
      this._subs.unsubscribe()
    }
  }

  private subscribeToDataProvider() {
    const serviceScene = sceneGraph.getAncestor(this, ServiceScene)
    const dataSubscriber = sceneGraph.getData(serviceScene).subscribeToState((newState, prevState) => {
      if (!areArraysEqual(newState.data?.series, prevState.data?.series)) {
        const dataFrame = getLogsPanelFrame(newState.data);

        // If we have a response, set it
        if (dataFrame && newState.data) {
          this.setState({
            data: newState,
          });

          // And update data node loading state
          this.state.body?.state.$data?.setState({
            data: {
              ...newState.data,
              state: LoadingState.Done,
            },
          });
        } else if (this.state.body?.state.$data && this.state.body?.state.$data.state.data) {
          // otherwise set a loading state in the viz
          this.state.body.state.$data.setState({
            ...this.state.body.state.$data.state,
            data: {
              ...this.state.body.state.$data.state.data,
              state: LoadingState.Loading,
            },
          });
        }
      }
    })

    console.log('setting sub', dataSubscriber)
    this.setState({
      dataSubscriber
    })
  }

  private getLogsPanel() {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const visualizationType = parentModel.state.visualizationType;

    const dataNode = new SceneDataNode({
      data: this.state.data?.data,
    });

    return (
      PanelBuilders.logs()
        .setTitle('Logs')
        .setData(dataNode)
        .setOption('showTime', true)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterLabel', this.handleLabelFilterClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterString', this.handleFilterStringClick)
        .setOption('wrapLogMessage', Boolean(getLogOption('wrapLines')))
        .setOption('showLogContextToggle', true)
        .setHeaderActions(
          <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
        )
        .build()
    );
  }

  private handleLabelFilterClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'toggle');
  };

  private handleLabelFilterOutClick = (key: string, value: string, frame?: DataFrame) => {
    this.handleLabelFilter(key, value, frame, 'exclude');
  };

  private handleIsFilterLabelActive = (key: string, value: string) => {
    const labels = getAdHocFiltersVariable(VAR_LABELS, this);
    const fields = getAdHocFiltersVariable(VAR_FIELDS, this);
    const levels = getAdHocFiltersVariable(VAR_LEVELS, this);

    const hasKeyValueFilter = (filter: AdHocFiltersVariable | null) =>
      filter &&
      filter.state.filters.findIndex(
        (filter) => filter.operator === '=' && filter.key === key && filter.value === value
      ) >= 0;

    return hasKeyValueFilter(labels) || hasKeyValueFilter(fields) || hasKeyValueFilter(levels);
  };

  private handleFilterStringClick = (value: string) => {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const lineFilterScene = parentModel.getLineFilterScene();
    if (lineFilterScene) {
      lineFilterScene.updateFilter(value);
      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_popover_line_filter,
        {
          selectionLength: value.length,
        }
      );
    }
  };

  private handleLabelFilter(key: string, value: string, frame: DataFrame | undefined, operator: FilterType) {
    // @TODO: NOOP. We need a way to let the user know why this is not possible.
    if (key === 'service_name') {
      return;
    }
    const type = frame ? getLabelTypeFromFrame(key, frame) : LabelType.Parsed;
    const variableName = type === LabelType.Indexed ? VAR_LABELS : VAR_FIELDS;
    addToFilters(key, value, operator, this, variableName);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
      {
        filterType: variableName,
        key,
        action: operator,
      }
    );
  }

  public static Component = ({ model }: SceneComponentProps<LogsPanelScene>) => {
    const { body } = model.useState();
    if (body) {
      return <body.Component model={body} />;
    }
    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
