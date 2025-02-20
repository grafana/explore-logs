import {
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneDataProvider,
  SceneDataState,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneQueryRunner,
  SceneReactObject,
} from '@grafana/scenes';
import { buildDataQuery, renderLogQLFieldFilters, renderLogQLMetadataFilters } from '../../../services/query';
import { getSortByPreference } from '../../../services/store';
import { DataQueryError, LoadingState } from '@grafana/data';
import { LayoutSwitcher } from './LayoutSwitcher';
import { getQueryRunner } from '../../../services/panel';
import { ByFrameRepeater } from './ByFrameRepeater';
import { Alert, DrawStyle, LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { buildFieldsQueryString, getFilterBreakdownValueScene, getParserForField } from '../../../services/fields';
import { getLabelValue } from './SortByScene';
import { ParserType, VAR_FIELDS, VAR_METADATA } from '../../../services/variables';
import React from 'react';
import { FIELDS_BREAKDOWN_GRID_TEMPLATE_COLUMNS, FieldsBreakdownScene } from './FieldsBreakdownScene';
import { getDetectedFieldsFrame } from '../ServiceScene';
import { DEFAULT_SORT_BY } from '../../../services/sorting';
import {
  getFieldGroupByVariable,
  getFieldsVariable,
  getLabelsVariable,
  getLevelsVariable,
  getLineFiltersVariable,
  getMetadataVariable,
  getPatternsVariable,
} from '../../../services/variableGetters';
import { LokiQuery } from '../../../services/lokiQuery';
import { getPanelWrapperStyles, PanelMenu } from '../../Panels/PanelMenu';
import { ValueSummaryPanelScene } from './Panels/ValueSummary';
import { areArraysEqual } from '../../../services/comparison';
import { logger } from '../../../services/logger';

export interface FieldValuesBreakdownSceneState extends SceneObjectState {
  body?: (LayoutSwitcher & SceneObject) | (SceneReactObject & SceneObject);
  $data?: SceneDataProvider;
  detectedFieldType?: ParserType;
}

export class FieldValuesBreakdownScene extends SceneObjectBase<FieldValuesBreakdownSceneState> {
  constructor(state: Partial<FieldValuesBreakdownSceneState>) {
    super(state);
    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Selector({ model }: SceneComponentProps<FieldValuesBreakdownScene>) {
    const { body } = model.useState();
    if (body instanceof LayoutSwitcher) {
      return <>{body && <LayoutSwitcher.Selector model={body} />}</>;
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

  private getTagKey() {
    const groupByVariable = getFieldGroupByVariable(this);
    return String(groupByVariable.state.value);
  }

  onActivate() {
    const tagKey = this.getTagKey();

    const fieldsVariable = getFieldsVariable(this);
    const detectedFieldsFrame = getDetectedFieldsFrame(this);
    const detectedFieldType = getParserForField(tagKey, this);

    const queryString = buildFieldsQueryString(tagKey, fieldsVariable, detectedFieldsFrame);
    const query = buildDataQuery(queryString, { legendFormat: `{{${tagKey}}}`, refId: tagKey });

    // Set query runner
    this.setState({
      body: this.build(query),
      detectedFieldType,
      $data: new SceneDataTransformer({
        $data: getQueryRunner([query], { runQueriesMode: 'manual' }),
        transformations: [],
      }),
    });

    // Subscribe to data query changes
    this._subs.add(
      this.state.$data?.subscribeToState((newState) => {
        this.onValuesDataQueryChange(newState, query);
      })
    );

    this.runQuery();
    this.setSubs();
  }

  private setSubs() {
    // Subscribe to time range changes
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        // Run query on time range change
        this.runQuery();
      })
    );

    // VARIABLE SUBS
    // Subscribe to line filter changes
    this._subs.add(
      getLineFiltersVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to pattern filter changes
    this._subs.add(
      getPatternsVariable(this).subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.runQuery();
        }
      })
    );

    // Subscribe to labels variable changes
    this._subs.add(
      getLabelsVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // Subscribe to levels variable changes
    this._subs.add(
      getLevelsVariable(this).subscribeToState((newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          this.runQuery();
        }
      })
    );

    // @todo need to clear subs when switching between field types in the dropdown??

    // Subscribe to metadata variable for external changes
    if (this.state.detectedFieldType !== 'structuredMetadata') {
      // Subscribe to any metadata change and run the query without alteration
      this._subs.add(
        getMetadataVariable(this).subscribeToState(async (newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            const queryRunner = this.getSceneQueryRunner();
            queryRunner?.runQueries();
          }
        })
      );
      // Subscribe to fields variable, run the query if the change wasn't for this label
      this._subs.add(
        getFieldsVariable(this).subscribeToState(async (newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            // Check to see if excluding this label changes the query string before running
            // If the filter change was for the label we're looking at, there's no need to re-run the query
            const prevFilterExpression = renderLogQLFieldFilters(prevState.filters, [this.getTagKey()]);
            const newFilterExpression = renderLogQLFieldFilters(newState.filters, [this.getTagKey()]);

            if (newFilterExpression !== prevFilterExpression) {
              this.removeFieldLabelFromVariableInterpolation();
              const queryRunner = this.getSceneQueryRunner();
              queryRunner?.runQueries();
            }
          }
        })
      );
    } else {
      // Subscribe to any fields change and run the query without change
      this._subs.add(
        getFieldsVariable(this).subscribeToState(async (newState, prevState) => {
          if (!areArraysEqual(newState.filters, prevState.filters)) {
            console.log('fields change trigger query', {
              new: newState.filters,
              prev: prevState.filters,
            });
            const queryRunner = this.getSceneQueryRunner();
            queryRunner?.runQueries();
          }
        })
      );

      getMetadataVariable(this).subscribeToState(async (newState, prevState) => {
        if (!areArraysEqual(newState.filters, prevState.filters)) {
          // Check to see if excluding this label changes the query string before running
          // If the filter change was for the label we're looking at, there's no need to re-run the query
          const prevFilterExpression = renderLogQLMetadataFilters(prevState.filters, [this.getTagKey()]);
          const newFilterExpression = renderLogQLMetadataFilters(newState.filters, [this.getTagKey()]);

          if (newFilterExpression !== prevFilterExpression) {
            console.log('metadata change trigger query');
            this.removeMetadataLabelFromVariableInterpolation();
            const queryRunner = this.getSceneQueryRunner();
            queryRunner?.runQueries();
          }
        }
      });
    }
  }

  /**
   * Run the field values breakdown query.
   * Generates the filterExpression excluding all filters with a key that matches the label.
   */
  private runQuery() {
    // Update the filters to exclude the current value so all options are displayed to the user
    this.removeFieldLabelFromVariableInterpolation();
    const queryRunner = this.getSceneQueryRunner();
    queryRunner?.runQueries();
  }

  private getSceneQueryRunner() {
    if (this.state.$data) {
      const queryRunners = sceneGraph.findDescendents(this.state.$data, SceneQueryRunner);
      if (queryRunners.length !== 1) {
        const error = new Error('Unable to find query runner in value breakdown!');
        logger.error(error, { msg: 'FieldValuesBreakdownScene: Unable to find query runner in value breakdown!' });
        throw error;
      }

      return queryRunners[0];
    }
    logger.warn('FieldValuesBreakdownScene: Query is attempting to execute, but query runner is undefined!');
    return undefined;
  }

  private removeFieldLabelFromVariableInterpolation() {
    const tagKey = this.getTagKey();

    if (this.state.detectedFieldType === 'structuredMetadata') {
      const metadataVar = getMetadataVariable(this);
      const filterExpression = renderLogQLFieldFilters(metadataVar.state.filters, [tagKey]);
      metadataVar.setState({
        filterExpression,
      });
      return filterExpression;
    } else {
      const fieldsVar = getFieldsVariable(this);
      const filterExpression = renderLogQLFieldFilters(fieldsVar.state.filters, [tagKey]);
      fieldsVar.setState({
        filterExpression,
      });
      return filterExpression;
    }
  }

  private removeMetadataLabelFromVariableInterpolation() {
    const tagKey = this.getTagKey();

    const metadataVar = getMetadataVariable(this);
    const metadataExpression = renderLogQLMetadataFilters(metadataVar.state.filters, [tagKey]);
    metadataVar.setState({
      filterExpression: metadataExpression,
    });

    return metadataExpression;
  }

  private onValuesDataQueryChange(newState: SceneDataState, query: LokiQuery) {
    if (newState.data?.state === LoadingState.Done) {
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
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries()
                .setTitle(optionValue)
                // 11.5
                // .setShowMenuAlways(true)
                .setMenu(new PanelMenu({}))
                .build(),
            }),
          ],
        }),

        // Grid
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new ValueSummaryPanelScene({ title: optionValue, type: 'field', tagKey: this.getTagKey() }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ValuesMenu model={fieldsBreakdownScene} />,
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
              reactNode: <FieldsBreakdownScene.LabelsMenu model={fieldsBreakdownScene} />,
            }),
            new ValueSummaryPanelScene({ title: optionValue, type: 'field', tagKey: this.getTagKey() }),
            new SceneReactObject({
              reactNode: <FieldsBreakdownScene.ValuesMenu model={fieldsBreakdownScene} />,
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
