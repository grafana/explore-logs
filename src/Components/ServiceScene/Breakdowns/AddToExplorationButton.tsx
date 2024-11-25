import { DataFrame, DataSourceJsonData, TimeRange } from '@grafana/data';
import { DataSourceWithBackend, usePluginLinks } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { DataQuery, DataSourceRef } from '@grafana/schema';
import { IconButton } from '@grafana/ui';
import React from 'react';
import { ExtensionPoints } from 'services/extensions/links';
import { getLokiDatasource } from 'services/scenes';

import LokiLogo from '../../../img/logo.svg';

export interface AddToExplorationButtonState extends SceneObjectState {
  frame?: DataFrame;
  labelName?: string;
  fieldName?: string;

  ds?: DataSourceWithBackend<DataQuery, DataSourceJsonData>;
  context?: ExtensionContext;

  queries: DataQuery[];
}

type ExtensionContext = {
  timeRange: TimeRange;
  queries: DataQuery[];
  datasource: DataSourceRef;
  origin: string;
  url: string;
  type: string;
  title: string;
  id: string;
  logoPath: string;
  note?: string;
  drillDownLabel?: string;
};

export class AddToExplorationButton extends SceneObjectBase<AddToExplorationButtonState> {
  constructor(state: Omit<AddToExplorationButtonState, 'queries'>) {
    super({ ...state, queries: [] });
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    getLokiDatasource(this).then((ds) => {
      this.setState({ ds });
    });

    this._subs.add(
      this.subscribeToState((newState, prevState) => {
        if (!this.state.queries.length) {
          this.getQueries();
        }
        if (!this.state.context && this.state.queries.length) {
          this.getContext();
        }
      })
    );
  };

  private getQueries = () => {
    const data = sceneGraph.getData(this);
    const queryRunner = sceneGraph.findObject(data, (o) => o instanceof SceneQueryRunner) as SceneQueryRunner;
    if (queryRunner) {
      const filter = this.state.frame ? getFilter(this.state.frame) : null;
      const queries = queryRunner.state.queries.map((q) => ({
        ...q,
        expr: sceneGraph.interpolate(queryRunner, q.expr),
        legendFormat: filter?.name ? `{{ ${filter.name} }}` : sceneGraph.interpolate(queryRunner, q.legendFormat),
      }));
      if (JSON.stringify(queries) !== JSON.stringify(this.state.queries)) {
        this.setState({ queries });
      }
    }
  };

  private getContext = () => {
    const { queries, ds, labelName, fieldName } = this.state;
    const timeRange = sceneGraph.getTimeRange(this);

    if (!timeRange || !queries || !ds?.uid) {
      return;
    }
    const ctx = {
      origin: 'Explore Logs',
      type: 'timeseries',
      queries,
      timeRange: { ...timeRange.state.value },
      datasource: { uid: ds.uid },
      url: window.location.href,
      id: `${JSON.stringify(queries)}${labelName}${fieldName}`,
      title: `${labelName}${fieldName ? ` > ${fieldName}` : ''}`,
      logoPath: LokiLogo,
      drillDownLabel: fieldName,
    };
    if (JSON.stringify(ctx) !== JSON.stringify(this.state.context)) {
      this.setState({ context: ctx });
    }
  };

  public static Component = ({ model }: SceneComponentProps<AddToExplorationButton>) => {
    const { context } = model.useState();
    const { links } = usePluginLinks({ extensionPointId: ExtensionPoints.MetricExploration, context });

    return (
      <>
        {links
          .filter((link) => link.pluginId === 'grafana-explorations-app' && link.onClick)
          .map((link) => (
            <IconButton
              tooltip={link.description}
              aria-label="extension-link-to-open-exploration"
              key={link.id}
              name={link.icon ?? 'panel-add'}
              onClick={(e) => {
                if (link.onClick) {
                  link.onClick(e);
                }
              }}
            />
          ))}
      </>
    );
  };
}

const getFilter = (frame: DataFrame) => {
  const filterNameAndValueObj = frame.fields[1]?.labels ?? {};
  if (Object.keys(filterNameAndValueObj).length !== 1) {
    return;
  }
  const name = Object.keys(filterNameAndValueObj)[0];
  return { name, value: filterNameAndValueObj[name] };
};
