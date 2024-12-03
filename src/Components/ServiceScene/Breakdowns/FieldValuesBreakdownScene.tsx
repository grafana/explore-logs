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
import { buildDataQuery } from '../../../services/query';
import { getSortByPreference } from '../../../services/store';
import { DataQueryError, LoadingState } from '@grafana/data';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getQueryRunner } from '../../../services/panel';
import { ByFrameRepeater } from './ByFrameRepeater';
import { Alert, DrawStyle, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { buildFieldsQueryString, getFilterBreakdownValueScene, getParserForField } from '../../../services/fields';
import { getLabelValue } from './SortByScene';
import { VAR_FIELDS, VAR_METADATA } from '../../../services/variables';
import React from 'react';
import { FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';
import { AddFilterEvent } from './AddToFiltersButton';
import { navigateToDrilldownPage } from '../../../services/navigate';
import { PageSlugs } from '../../../services/routing';
import { getDetectedFieldsFrame, ServiceScene } from '../ServiceScene';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import { getFieldGroupByVariable, getFieldsVariable } from '../../../services/variableGetters';
import { LokiQuery } from '../../../services/lokiQuery';
import { PanelMenu, getPanelWrapperStyles } from '../../Panels/PanelMenu';

export interface FieldValuesBreakdownSceneState extends SceneObjectState {
  body?: (LayoutSwitcher & SceneObject) | (SceneReactObject & SceneObject);
  $data?: SceneDataProvider;
  lastFilterEvent?: AddFilterEvent;
}

export class FieldValuesBreakdownScene extends SceneObjectBase<FieldValuesBreakdownSceneState> {
  constructor(state: Partial<FieldValuesBreakdownSceneState>) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Selector({ model }: SceneComponentProps<FieldValuesBreakdownScene>) {
    const { body } = model.useState();
    if (body instanceof LayoutSwitcher) {
      return <>{body && <body.Selector model={body} />}</>;
    }

    return <></>;
  }

  public static Component = ({ model }: SceneComponentProps<FieldValuesBreakdownScene>) => {
    const { body } = model.useState();
    const styles = useStyles2(getPanelWrapperStyles);
    if (body) {
      return <span className={styles.panelWrapper}>{body && <body.Component model={body} />}</span>;
    }

    return <LoadingPlaceholder text={'Loading...'} />;
  };

  onActivate() {
    const groupByVariable = getFieldGroupByVariable(this);
    const tagKey = String(groupByVariable.state.value);

    const fieldsVariable = getFieldsVariable(this);
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const queryString = buildFieldsQueryString(tagKey, fieldsVariable, detectedFieldsFrame);
    const query = buildDataQuery(queryString, { legendFormat: `{{${tagKey}}}`, refId: tagKey });

    this.setState({
      body: this.build(query),
      $data: getQueryRunner([query]),
    });

    this._subs.add(
      this.subscribeToEvent(AddFilterEvent, (event) => {
        this.setState({
          lastFilterEvent: event,
        });
      })
    );

    this._subs.add(
      this.state.$data?.subscribeToState((newState) => {
        this.onValuesDataQueryChange(newState, query);
      })
    );
  }

  private onValuesDataQueryChange(newState: SceneDataState, query: LokiQuery) {
    if (newState.data?.state === LoadingState.Done) {
      // No panels for the user to select, presumably because everything has been excluded
      const event = this.state.lastFilterEvent;

      // @todo discuss: Do we want to let users exclude all fields? Or should we redirect when excluding the penultimate panel?
      if (newState.data?.state === LoadingState.Done && event) {
        if (event.operator === 'exclude' && newState.data.series.length < 1) {
          this.navigateToFields();
        }

        // @todo discuss: wouldn't include always return in 1 result? Do we need to wait for the query to run or should we navigate on receiving the include event and cancel the ongoing query?
        if (event.operator === 'include' && newState.data.series.length <= 1) {
          this.navigateToFields();
        }
      }

      if (this.state.body instanceof SceneReactObject) {
        this.setState({
          body: this.build(query),
        });
      }
    }
    if (newState.data?.state === LoadingState.Error) {
      this.setErrorState(newState.data.errors);
    }
  }

  private setErrorState(errors: DataQueryError[] | undefined) {
    this.setState({
      body: new SceneReactObject({
        reactNode: (
          <Alert title={'Something went wrong with your request'} severity={'error'}>
            {errors?.map((err, key) => (
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
            ))}
          </Alert>
        ),
      }),
    });
  }

  private navigateToFields() {
    this.setState({
      lastFilterEvent: undefined,
    });
    navigateToDrilldownPage(PageSlugs.fields, sceneGraph.getAncestor(this, ServiceScene));
  }

  private build(query: LokiQuery) {
    const groupByVariable = getFieldGroupByVariable(this);
    const optionValue = String(groupByVariable.state.value);

    const { sortBy, direction } = getSortByPreference('fields', DEFAULT_SORT_BY, 'desc');

    const fieldsBreakdownScene = sceneGraph.getAncestor(this, FieldsBreakdownScene);
    const getFilter = () => fieldsBreakdownScene.state.search.state.filter ?? '';

    const parserForThisField = getParserForField(optionValue, this);

    return new LayoutSwitcher({
      options: [
        { value: 'single', label: 'Single' },
        { value: 'grid', label: 'Grid' },
        { value: 'rows', label: 'Rows' },
      ],
      active: 'grid',
      layouts: [
        // Single
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ParentMenu model={fieldsBreakdownScene} />,
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle(optionValue).setMenu(new PanelMenu({})).build(),
            }),
          ],
        }),

        // Grid
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ParentMenu model={fieldsBreakdownScene} />,
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle(optionValue).setMenu(new PanelMenu({})).build(),
            }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.FieldValueMenu model={fieldsBreakdownScene} />,
            }),
            new ByFrameRepeater({
              body: new SceneCSSGridLayout({
                templateColumns: FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS,
                autoRows: '200px',
                children: [
                  new SceneFlexItem({
                    body: new SceneReactObject({
                      reactNode: <LoadingPlaceholder text="Loading..." />,
                    }),
                  }),
                ],
                isLazy: true,
              }),
              getLayoutChild: getFilterBreakdownValueScene(
                getLabelValue,
                query?.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
                parserForThisField === 'structuredMetadata' ? VAR_METADATA : VAR_FIELDS,
                sceneGraph.getAncestor(this, FieldsBreakdownScene).state.sort,
                optionValue
              ),
              sortBy,
              direction,
              getFilter,
            }),
          ],
        }),

        // Rows
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ParentMenu model={fieldsBreakdownScene} />,
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle(optionValue).setMenu(new PanelMenu({})).build(),
            }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.FieldValueMenu model={fieldsBreakdownScene} />,
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
                isLazy: true,
              }),
              getLayoutChild: getFilterBreakdownValueScene(
                getLabelValue,
                query?.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
                parserForThisField === 'structuredMetadata' ? VAR_METADATA : VAR_FIELDS,
                sceneGraph.getAncestor(this, FieldsBreakdownScene).state.sort,
                optionValue
              ),
              sortBy,
              direction,
              getFilter,
            }),
          ],
        }),
      ],
    });
  }
}
