import React from 'react';

import {
  AdHocFiltersVariable,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { LineFilter } from '../LineFilter';
import { getTablePanel } from '@/components/Explore/panels/tablePanel';
import { VAR_FIELDS } from '@/utils/shared';
import { AdHocVariableFilter, TimeRange } from '@grafana/data';
import { SelectedTableRow } from '@/components/Table/LogLineCellComponent';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  tableColumns?: string[];
  selectedLine?: SelectedTableRow;
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tableColumns', 'selectedLine'] });

  constructor(state: Partial<LogsListSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this._onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<LogsListScene>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };

  getUrlState() {
    let stateUpdate: Partial<{
      tableColumns?: string;
      selectedLine?: string;
    }> = {};
    if (this.state.tableColumns?.length) {
      stateUpdate.tableColumns = JSON.stringify(this.state.tableColumns);
    }
    if (this.state.selectedLine) {
      stateUpdate.selectedLine = JSON.stringify(this.state.selectedLine);
    }
    return stateUpdate;
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {};
    // Selected table columns
    if (typeof values.tableColumns === 'string') {
      const tableColumns = JSON.parse(values.tableColumns);
      if (tableColumns !== this.state.tableColumns) {
        stateUpdate.tableColumns = tableColumns;
      }
    }

    // Selected line
    if (typeof values.selectedLine === 'string') {
      const selectedLine = JSON.parse(values.selectedLine);
      if (selectedLine !== this.state.selectedLine) {
        stateUpdate.selectedLine = selectedLine;
      }
    }

    if (stateUpdate) {
      this.setState(stateUpdate);
    }
  }

  public _onActivate() {
    const addFilter = (filter: AdHocVariableFilter) => {
      const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
      const filters = fields.state.filters;
      fields.setState({
        filters: [...filters, filter],
      });
    };

    if (!this.state.panel) {
      const fields = sceneGraph.lookupVariable(VAR_FIELDS, this)! as AdHocFiltersVariable;
      const filters = fields.state.filters;

      const range = sceneGraph.getTimeRange(this).state.value;
      // const selectedLine = this.state.selectedLine ??

      this.setState({
        panel: this.getVizPanel({
          filters,
          addFilter,
          selectedColumns: this.state.tableColumns ?? null,
          setSelectedColumns: (cols) => {
            this.setState({
              tableColumns: cols,
            });
          },
          selectedLine: this.state.selectedLine,
          timeRange: range,
        }),
      });
    }
  }

  private getVizPanel(props: TablePanelProps) {
    return new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          body: new LineFilter(),
          ySizing: 'content',
        }),
        new SceneFlexItem({
          height: 'calc(100vh - 220px)',
          body: getTablePanel(props),
        }),
      ],
    });
  }
}

// Values/callbacks passed into react table component from scene
export interface TablePanelProps {
  filters: AdHocVariableFilter[];
  addFilter: (filter: AdHocVariableFilter) => void;
  selectedColumns: string[] | null;
  setSelectedColumns: (cols: string[]) => void;
  //@todo need to get and set timerange in url
  selectedLine?: SelectedTableRow;
  timeRange?: TimeRange;
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({}),
  });
}
