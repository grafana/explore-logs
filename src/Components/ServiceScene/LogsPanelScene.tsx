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
import { getDisplayedFields, getLogOption, setDisplayedFields } from '../../services/store';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import React from 'react';
import { LogsListScene } from './LogsListScene';
import { LoadingPlaceholder } from '@grafana/ui';
import { addToFilters, FilterType } from './Breakdowns/AddToFiltersButton';
import { getLabelTypeFromFrame, LabelType } from '../../services/fields';
import { getAdHocFiltersVariable, VAR_FIELDS, VAR_LABELS, VAR_LEVELS } from '../../services/variables';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from '../../services/analytics';
import { SERVICE_NAME } from '../ServiceSelectionScene/ServiceSelectionScene';

interface LogsPanelSceneState extends SceneObjectState {
  body?: VizPanel;
}

export class LogsPanelScene extends SceneObjectBase<LogsPanelSceneState> {
  displayedFields: string[] = [];
  constructor(state: Partial<LogsPanelSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public onActivate() {
    this.displayedFields = getDisplayedFields(this);
    if (!this.state.body) {
      this.setState({
        body: this.getLogsPanel(),
      });
    }
  }

  onClickShowField = (field: string) => {
    const index = this.displayedFields.indexOf(field);
    if (index === -1 && this.state.body) {
      this.displayedFields = [...this.displayedFields, field];
      this.state.body.onOptionsChange({
        displayedFields: this.displayedFields,
      });
      setDisplayedFields(this, this.displayedFields);
    }
  };

  onClickHideField = (field: string) => {
    const index = this.displayedFields.indexOf(field);
    if (index >= 0 && this.state.body) {
      this.displayedFields = this.displayedFields.filter((displayedField) => field !== displayedField);
      this.state.body.onOptionsChange({
        displayedFields: this.displayedFields,
      });
    }
  };

  private getLogsPanel() {
    const parentModel = sceneGraph.getAncestor(this, LogsListScene);
    const visualizationType = parentModel.state.visualizationType;

    return (
      PanelBuilders.logs()
        .setTitle('Logs')
        .setOption('showTime', true)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterLabel', this.handleLabelFilterClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterOutLabel', this.handleLabelFilterOutClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('isFilterLabelActive', this.handleIsFilterLabelActive)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickFilterString', this.handleFilterStringClick)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickShowField', this.onClickShowField)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('onClickHideField', this.onClickHideField)
        // @ts-expect-error Requires unreleased @grafana/data. Type error, doesn't cause other errors.
        .setOption('displayedFields', this.displayedFields)
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
    if (key === SERVICE_NAME) {
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
