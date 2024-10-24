import {
  AdHocFiltersVariable,
  PanelBuilders,
  SceneComponentProps,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';
import { DataFrame } from '@grafana/data';
import { getLogOption, setDisplayedFields } from '../../services/store';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import React from 'react';
import { LogsListScene } from './LogsListScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { getVariableForLabel } from '../../services/fields';
import { VAR_FIELDS, VAR_LABELS, VAR_LEVELS, VAR_METADATA } from '../../services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { getAdHocFiltersVariable, getValueFromFieldsFilter } from '../../services/variableGetters';

interface LogsPanelSceneState extends SceneObjectState {
  body?: VizPanel;
}

export class LogsPanelScene extends SceneObjectBase<LogsPanelSceneState> {
  constructor(state: Partial<LogsPanelSceneState>) {
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
  }

  onClickShowField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index === -1 && this.state.body) {
      const displayedFields = [...parent.state.displayedFields, field];
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, parent.state.displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  onClickHideField = (field: string) => {
    const parent = this.getParentScene();
    const index = parent.state.displayedFields.indexOf(field);

    if (index >= 0 && this.state.body) {
      const displayedFields = parent.state.displayedFields.filter((displayedField) => field !== displayedField);
      this.setLogsVizOption({
        displayedFields,
      });
      parent.setState({ displayedFields });
      setDisplayedFields(this, parent.state.displayedFields);

      reportAppInteraction(
        USER_EVENTS_PAGES.service_details,
        USER_EVENTS_ACTIONS.service_details.logs_toggle_displayed_field
      );
    }
  };

  setLogsVizOption(options = {}) {
    if (!this.state.body) {
      return;
    }
    this.state.body.onOptionsChange(options);
  }

  clearDisplayedFields = () => {
    if (!this.state.body) {
      return;
    }
    this.setLogsVizOption({
      displayedFields: [],
    });
    setDisplayedFields(this, []);
  };

  private getParentScene() {
    return sceneGraph.getAncestor(this, LogsListScene);
  }

  private getLogsPanel() {
    const parentModel = this.getParentScene();
    const visualizationType = parentModel.state.visualizationType;

    return PanelBuilders.logs()
      .setTitle('Logs')
      .setOption('showTime', true)
      .setOption('onClickFilterLabel', this.handleLabelFilterClick)
      .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
      .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
      .setOption('onClickFilterString', this.handleFilterStringClick)
      .setOption('onClickShowField', this.onClickShowField)
      .setOption('onClickHideField', this.onClickHideField)
      .setOption('displayedFields', parentModel.state.displayedFields)
      .setOption('wrapLogMessage', Boolean(getLogOption('wrapLines')))
      .setOption('showLogContextToggle', true)
      .setHeaderActions(
        <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
      )
      .build();
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
    const metadata = getAdHocFiltersVariable(VAR_METADATA, this);

    const hasKeyValueFilter = (filter: AdHocFiltersVariable | null) => {
      return (
        filter &&
        filter.state.filters.findIndex(
          (filter) => filter.operator === '=' && filter.key === key && filter.value === value
        ) >= 0
      );
    };

    // Fields have json encoded values unlike the other variables, get the value for the matching filter and parse it before comparing
    const hasKeyValueFilterField = (filter: AdHocFiltersVariable | null) => {
      if (filter) {
        const fieldFilter = filter.state.filters.find((filter) => filter.operator === '=' && filter.key === key);

        if (fieldFilter) {
          const fieldValue = getValueFromFieldsFilter(fieldFilter, key);
          return fieldValue.value === value;
        }
      }
      return false;
    };

    return (
      hasKeyValueFilter(labels) ||
      hasKeyValueFilterField(fields) ||
      hasKeyValueFilter(levels) ||
      hasKeyValueFilter(metadata)
    );
  };

  private handleFilterStringClick = (value: string) => {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const lineFilterScene = parentModel.getLineFilterScene();
    if (lineFilterScene) {
      lineFilterScene.updateFilter(value, false);
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
    const variableType = getVariableForLabel(frame, key, this);

    addToFilters(key, value, operator, this, variableType);

    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.logs_detail_filter_applied,
      {
        filterType: variableType,
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
