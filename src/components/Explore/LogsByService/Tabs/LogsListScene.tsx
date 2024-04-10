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
import { AdHocVariableFilter } from '@grafana/data';
import { isArray } from 'lodash';

export interface LogsListSceneState extends SceneObjectState {
  loading?: boolean;
  panel?: SceneFlexLayout;
  tableColumns?: string[];
}

export class LogsListScene extends SceneObjectBase<LogsListSceneState> {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['tableColumns'] });

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
    return { tableColumns: this.state.tableColumns };
  }

  updateFromUrl(values: SceneObjectUrlValues) {
    const stateUpdate: Partial<LogsListSceneState> = {
      tableColumns: [],
    };

    if (
      isArray(values.tableColumns) &&
      values.tableColumns?.length &&
      values.tableColumns !== this.state.tableColumns
    ) {
      stateUpdate.tableColumns = values.tableColumns;
    }

    this.setState(stateUpdate);
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
      this.setState({
        panel: this.getVizPanel({
          filters,
          addFilter,
          selectedColumns: this.state.tableColumns ?? [],
          setSelectedColumns: (cols) => {
            console.log('incoming cols', cols);
            console.log(this.state.tableColumns);
            this.setState({
              tableColumns: cols,
            });
          },
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
  selectedColumns: string[];
  setSelectedColumns: (cols: string[]) => void;
  //@todo need to get and set timerange in url
  //@todo need to add selected line
}

export function buildLogsListScene() {
  return new SceneFlexItem({
    body: new LogsListScene({
      tableColumns: [],
    }),
  });
}
