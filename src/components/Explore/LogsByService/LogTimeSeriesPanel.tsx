import React from 'react';

import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneDataTransformer,
} from '@grafana/scenes';
import { explorationDS, LOG_STREAM_SELECTOR_EXPR_VOLUME } from '../../../utils/shared';
import { DrawStyle, StackingMode } from '@grafana/ui';
import { DataFrame } from '@grafana/data';
import { map, Observable } from 'rxjs';

export interface LogTimeSeriesPanelState extends SceneObjectState {
  panel?: SceneFlexLayout;
}

export class LogTimeSeriesPanel extends SceneObjectBase<LogTimeSeriesPanelState> {
  constructor(state: LogTimeSeriesPanelState) {
    super(state);

    this.addActivationHandler(this._onActivate.bind(this));
  }

  private _onActivate() {
    if (!this.state.panel) {
      this.setState({
        panel: this.getVizPanel(),
      });
    }
  }

  private getVizPanel() {
    return new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          body: PanelBuilders.timeseries() //
            .setTitle('Log volume')
            .setOption('legend', { showLegend: false })
            .setData(
              new SceneDataTransformer({
                $data: new SceneQueryRunner({
                  datasource: explorationDS,
                  queries: [buildQuery()],
                }),
                transformations: [
                  () => (source: Observable<DataFrame[]>) => {
                    return source.pipe(
                      map((data: DataFrame[]) => {
                        return data.sort((a, b) => {
                          const aName = a.fields[1].config.displayNameFromDS;
                          const aVal = aName?.includes('error')
                            ? 4
                            : aName?.includes('warn')
                            ? 3
                            : aName?.includes('info')
                            ? 2
                            : 1;
                          const bName = b.fields[1].config.displayNameFromDS;
                          const bVal = bName?.includes('error')
                            ? 4
                            : bName?.includes('warn')
                            ? 3
                            : bName?.includes('info')
                            ? 2
                            : 1;
                          return aVal - bVal;
                        });
                      })
                    );
                  },
                ],
              })
            )
            .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
            .setCustomFieldConfig('fillOpacity', 100)
            .setCustomFieldConfig('lineWidth', 0)
            .setCustomFieldConfig('pointSize', 0)
            .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
            .setOverrides((overrides) => {
              overrides.matchFieldsWithName('{level="info"}').overrideColor({
                mode: 'fixed',
                fixedColor: 'semi-dark-green',
              });
              overrides.matchFieldsWithName('{level="debug"}').overrideColor({
                mode: 'fixed',
                fixedColor: 'semi-dark-blue',
              });
              overrides.matchFieldsWithName('{level="error"}').overrideColor({
                mode: 'fixed',
                fixedColor: 'semi-dark-red',
              });
              overrides.matchFieldsWithName('{level="warn"}').overrideColor({
                mode: 'fixed',
                fixedColor: 'semi-dark-orange',
              });
            })
            .build(),
        }),
      ],
    });
  }

  public static Component = ({ model }: SceneComponentProps<LogTimeSeriesPanel>) => {
    const { panel } = model.useState();

    if (!panel) {
      return;
    }

    return <panel.Component model={panel} />;
  };
}

function buildQuery() {
  return {
    refId: 'A',
    expr: `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR_VOLUME} [$__auto])) by (level)`,
    queryType: 'range',
    editorMode: 'code',
  };
}
