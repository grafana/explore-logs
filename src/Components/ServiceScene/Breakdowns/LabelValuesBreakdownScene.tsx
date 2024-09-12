import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getLabelValue } from './SortByScene';
import { DrawStyle, LoadingPlaceholder, StackingMode } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { getSortByPreference } from '../../../services/store';
import { LoadingState } from '@grafana/data';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import {
  ALL_VARIABLE_VALUE,
  getLabelGroupByVariable,
  VAR_LABEL_GROUP_BY_EXPR,
  VAR_LABELS,
} from '../../../services/variables';
import React from 'react';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { navigateToDrilldownPage } from '../../../services/navigate';
import { PageSlugs } from '../../../services/routing';
import { ServiceScene } from '../ServiceScene';
import { AddFilterEvent } from './AddToFiltersButton';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from '../../../services/labels';

export interface LabelValueBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  $data?: SceneDataProvider;
  lastFilterEvent?: AddFilterEvent;
}

export class LabelValuesBreakdownScene extends SceneObjectBase<LabelValueBreakdownSceneState> {
  constructor(state: Partial<LabelValueBreakdownSceneState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      $data: getQueryRunner([
        buildLabelsQuery(this, VAR_LABEL_GROUP_BY_EXPR, String(getLabelGroupByVariable(this).state.value)),
      ]),
    });
    this.setState({
      body: this.build(),
    });

    const groupByVariable = getLabelGroupByVariable(this);
    this._subs.add(
      groupByVariable.subscribeToState((newState) => {
        if (newState.value === ALL_VARIABLE_VALUE) {
          this.setState({
            $data: undefined,
            body: undefined,
          });
        }
      })
    );

    this.subscribeToEvent(AddFilterEvent, (event) => {
      this.setState({
        lastFilterEvent: event,
      });
    });

    this._subs.add(
      this.state.$data?.subscribeToState((newState, prevState) => {
        this.onValuesDataQueryChange(newState, prevState);
      })
    );
  }

  private onValuesDataQueryChange(newState: SceneDataState, prevState: SceneDataState) {
    if (newState.data?.state === LoadingState.Done) {
      // No panels for the user to select, presumably because everything has been excluded
      const event = this.state.lastFilterEvent;

      // @todo discuss: Do we want to let users exclude all labels? Or should we redirect when excluding the penultimate panel?
      if (newState.data?.state === LoadingState.Done && event) {
        if (event.operator === 'exclude' && newState.data.series.length < 1) {
          this.navigateToLabels();
        }

        // @todo discuss: wouldn't include always return in 1 result? Do we need to wait for the query to run or should we navigate on receiving the include event and cancel the ongoing query?
        if (event.operator === 'include' && newState.data.series.length <= 1) {
          this.navigateToLabels();
        }
      }
    }
  }

  private navigateToLabels() {
    this.setState({
      lastFilterEvent: undefined,
    });
    navigateToDrilldownPage(PageSlugs.labels, sceneGraph.getAncestor(this, ServiceScene));
  }

  private build(): LayoutSwitcher {
    const variable = getLabelGroupByVariable(this);
    const variableState = variable.state;
    const labelBreakdownScene = sceneGraph.getAncestor(this, LabelBreakdownScene);
    const tagKey = String(variableState?.value);

    let bodyOpts = PanelBuilders.timeseries();
    bodyOpts = bodyOpts
      .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
      .setCustomFieldConfig('fillOpacity', 100)
      .setCustomFieldConfig('lineWidth', 0)
      .setCustomFieldConfig('pointSize', 0)
      .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
      .setOverrides(setLevelColorOverrides)
      .setTitle(tagKey);

    const body = bodyOpts.build();
    const { sortBy, direction } = getSortByPreference('labels', DEFAULT_SORT_BY, 'desc');

    const getFilter = () => labelBreakdownScene.state.search.state.filter ?? '';

    return new LayoutSwitcher({
      options: [
        { value: 'single', label: 'Single' },
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body,
            }),
          ],
        }),
        new ByFrameRepeater({
          body: new SceneCSSGridLayout({
            isLazy: true,
            templateColumns: LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
            autoRows: '200px',
            children: [
              new SceneFlexItem({
                body: new SceneReactObject({
                  reactNode: <LoadingPlaceholder text="Loading..." />,
                }),
              }),
            ],
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            DrawStyle.Bars,
            VAR_LABELS,
            sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort
          ),
          sortBy,
          direction,
          getFilter,
        }),
        new ByFrameRepeater({
          body: new SceneCSSGridLayout({
            templateColumns: '1fr',
            autoRows: '200px',
            children: [
              new SceneFlexItem({
                body: new SceneReactObject({
                  reactNode: <LoadingPlaceholder text="Loading..." />,
                }),
              }),
            ],
          }),
          getLayoutChild: getFilterBreakdownValueScene(
            getLabelValue,
            DrawStyle.Bars,
            VAR_LABELS,
            sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  public static Selector({ model }: SceneComponentProps<LabelValuesBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelValuesBreakdownScene>) => {
    const { body } = model.useState();
    if (body) {
      return <>{body && <body.Component model={body} />}</>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
