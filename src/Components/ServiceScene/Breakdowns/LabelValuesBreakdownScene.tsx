import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataState,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
} from '@grafana/scenes';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getLabelValue } from './SortByScene';
import { Alert, DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { getQueryRunner, setLevelColorOverrides } from '../../../services/panel';
import { getSortByPreference } from '../../../services/store';
import { AppEvents, DataQueryError, LoadingState } from '@grafana/data';
import { ByFrameRepeater } from './ByFrameRepeater';
import { getFilterBreakdownValueScene } from '../../../services/fields';
import { ALL_VARIABLE_VALUE, VAR_LABEL_GROUP_BY_EXPR, VAR_LABELS } from '../../../services/variables';
import React from 'react';
import { LabelBreakdownScene } from './LabelBreakdownScene';
import { navigateToDrilldownPage } from '../../../services/navigate';
import { PageSlugs } from '../../../services/routing';
import { ServiceScene } from '../ServiceScene';
import { AddFilterEvent } from './AddToFiltersButton';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { buildLabelsQuery, LABEL_BREAKDOWN_GRID_TEMPLATE_COLUMNS } from '../../../services/labels';
import { getAppEvents } from '@grafana/runtime';
import { getLabelGroupByVariable } from '../../../services/variableGetters';
import { ExploreLogsVizPanelMenu, getPanelWrapperStyles } from '../../Panels/ExploreLogsVizPanelMenu';

type DisplayError = DataQueryError & { displayed: boolean };
type DisplayErrors = Record<string, DisplayError>;

export interface LabelValueBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher & SceneObject;
  $data?: SceneDataProvider;
  lastFilterEvent?: AddFilterEvent;
  errors: DisplayErrors;
}

export class LabelValuesBreakdownScene extends SceneObjectBase<LabelValueBreakdownSceneState> {
  constructor(state: Partial<LabelValueBreakdownSceneState>) {
    super({
      ...state,
      errors: {},
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  onActivate() {
    this.setState({
      $data: getQueryRunner([
        buildLabelsQuery(this, VAR_LABEL_GROUP_BY_EXPR, String(getLabelGroupByVariable(this).state.value)),
      ]),
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
    if (newState?.data?.errors && newState.data?.state !== LoadingState.Done) {
      const errors: DisplayErrors = this.state.errors;
      newState?.data?.errors.forEach((err) => {
        const errorIndex = `${err.status}_${err.traceId}_${err.message}`;
        if (errors[errorIndex] === undefined) {
          errors[errorIndex] = { ...err, displayed: false };
        }
      });
      this.setState({
        errors,
      });

      this.showErrorToast(this.state.errors);
    }

    if (newState.data?.state === LoadingState.Done || newState.data?.state === LoadingState.Streaming) {
      // No panels for the user to select, presumably because everything has been excluded
      const event = this.state.lastFilterEvent;

      // @todo discuss: Do we want to let users exclude all labels? Or should we redirect when excluding the penultimate panel?
      if (event) {
        if (event.operator === 'exclude' && newState.data.series.length < 1) {
          this.navigateToLabels();
        }

        // @todo discuss: wouldn't include always return in 1 result? Do we need to wait for the query to run or should we navigate on receiving the include event and cancel the ongoing query?
        if (event.operator === 'include' && newState.data.series.length <= 1) {
          this.navigateToLabels();
        }
      }
    }

    // If we're in an error state
    if (newState.data?.state === LoadingState.Error && this.activeLayoutContainsNoPanels()) {
      const activeLayout = this.getActiveLayout();
      // And the active layout is grid or rows, and doesn't have any panels
      if (activeLayout instanceof ByFrameRepeater) {
        const errorState = this.getErrorStateAlert(newState.data.errors);
        // Replace the loading or error state with new error
        activeLayout.state.body.setState({
          children: [errorState],
        });
      }
    }
  }

  private getActiveLayout(): ByFrameRepeater | SceneFlexLayout | undefined {
    const layoutSwitcher = this.state.body;
    const activeLayout = layoutSwitcher?.state.layouts.find((layout) => layout.isActive);
    if (activeLayout instanceof ByFrameRepeater || activeLayout instanceof SceneFlexLayout) {
      return activeLayout;
    }
    return undefined;
  }

  private activeLayoutContainsNoPanels(): boolean {
    const activeLayout = this.getActiveLayout();

    if (activeLayout instanceof ByFrameRepeater) {
      const child = activeLayout.state.body.state.children[0];
      if (child instanceof SceneFlexItem || child instanceof SceneReactObject) {
        return true;
      }
    }

    return false;
  }

  private getErrorStateAlert(errors: DataQueryError[] | undefined) {
    return new SceneReactObject({
      reactNode: (
        <Alert title={'Something went wrong with your request'} severity={'error'}>
          {errors?.map((err, key) => this.renderError(key, err))}
        </Alert>
      ),
    });
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
      .setMenu(new ExploreLogsVizPanelMenu({}))
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
            sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort,
            tagKey
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
            sceneGraph.getAncestor(this, LabelBreakdownScene).state.sort,
            tagKey
          ),
          sortBy,
          direction,
          getFilter,
        }),
      ],
    });
  }

  private showErrorToast(errors: DisplayErrors) {
    const appEvents = getAppEvents();

    // Make sure we only display each error once
    let errorArray: DisplayError[] = [];
    for (const err in errors) {
      const displayError = errors[err];
      if (!displayError.displayed) {
        errorArray.push(displayError);
        displayError.displayed = true;
      }
    }

    if (errorArray.length) {
      // If we don't have any panels the error message will replace the loading state, we want to set it as displayed but not render the toast
      if (!this.activeLayoutContainsNoPanels()) {
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: errorArray?.map((err, key) => this.renderError(key, err)),
        });
      }
      this.setState({
        errors,
      });
    }
  }

  private renderError(key: number, err: DataQueryError) {
    return (
      <div key={key}>
        {err.status && (
          <>
            <strong>Status</strong>: {err.status} <br />
          </>
        )}
        {err.message && (
          <>
            <strong>Message</strong>: {err.message} <br />
          </>
        )}
        {err.traceId && (
          <>
            <strong>TraceId</strong>: {err.traceId}
          </>
        )}
      </div>
    );
  }

  public static Selector({ model }: SceneComponentProps<LabelValuesBreakdownScene>) {
    const { body } = model.useState();
    return <>{body && body instanceof LayoutSwitcher && <body.Selector model={body} />}</>;
  }

  public static Component = ({ model }: SceneComponentProps<LabelValuesBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (body) {
      return <span className={styles.panelWrapper}>{body && <body.Component model={body} />}</span>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };
}
