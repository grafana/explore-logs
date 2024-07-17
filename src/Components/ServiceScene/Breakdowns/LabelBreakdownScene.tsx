import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import {
  AdHocFiltersVariable,
  CustomVariable,
  PanelBuilders,
  SceneComponentProps,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneFlexItem,
  SceneFlexItemLike,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
  SceneReactObject,
  SceneVariableSet,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { Alert, Button, DrawStyle, LoadingPlaceholder, StackingMode, useStyles2 } from '@grafana/ui';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { DetectedLabel, DetectedLabelsResponse, getFilterBreakdownValueScene } from 'services/fields';
import { getQueryRunner, setLeverColorOverrides } from 'services/panel';
import { buildLokiQuery } from 'services/query';
import { PLUGIN_ID } from 'services/routing';
import { getLokiDatasource } from 'services/scenes';
import { ALL_VARIABLE_VALUE, LOG_STREAM_SELECTOR_EXPR, VAR_LABELS, VAR_LABEL_GROUP_BY } from 'services/variables';
import { ByFrameRepeater } from './ByFrameRepeater';
import { FieldSelector } from './FieldSelector';
import { LayoutSwitcher } from './LayoutSwitcher';
import { StatusWrapper } from './StatusWrapper';
import { getLabelOptions, sortLabelsByCardinality } from 'services/filters';
import { BreakdownSearchScene, getLabelValue } from './BreakdownSearchScene';
import { getSortByPreference } from 'services/store';
import { SortByScene, SortCriteriaChanged } from './SortByScene';

export interface LabelBreakdownSceneState extends SceneObjectState {
  body?: LayoutSwitcher;
  search: BreakdownSearchScene;
  sort: SortByScene;
  labels: Array<SelectableValue<string>>;
  value?: string;
  loading?: boolean;
  error?: boolean;
  blockingMessage?: string;
}

export class LabelBreakdownScene extends SceneObjectBase<LabelBreakdownSceneState> {
  protected _variableDependency = new VariableDependencyConfig(this, {
    variableNames: [VAR_LABELS],
    onReferencedVariableValueChanged: this.onReferencedVariableValueChanged.bind(this),
  });

  constructor(state: Partial<LabelBreakdownSceneState>) {
    super({
      ...state,
      $variables:
        state.$variables ??
        new SceneVariableSet({
          variables: [new CustomVariable({ name: VAR_LABEL_GROUP_BY, defaultToAll: true, includeAll: true })],
        }),
      labels: state.labels ?? [],
      loading: true,
      sort: new SortByScene({ target: 'labels' }),
      search: new BreakdownSearchScene(),
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  private onActivate() {
    this.subscribeToEvent(SortCriteriaChanged, this.handleSortByChange);

    const variable = this.getVariable();

    variable.subscribeToState((newState, oldState) => {
      if (
        newState.options !== oldState.options ||
        newState.value !== oldState.value ||
        newState.loading !== oldState.loading
      ) {
        this.updateBody(variable);
      }
    });

    this.updateBody(variable);
  }

  private getVariable(): CustomVariable {
    const variable = sceneGraph.lookupVariable(VAR_LABEL_GROUP_BY, this)!;
    if (!(variable instanceof CustomVariable)) {
      throw new Error('Group by variable not found');
    }

    return variable;
  }

  private onReferencedVariableValueChanged() {
    const variable = this.getVariable();
    variable.changeValueTo(ALL_VARIABLE_VALUE);
    this.updateBody(variable);
  }

  private handleSortByChange = (event: SortCriteriaChanged) => {
    if (event.target !== 'labels') {
      return;
    }
    if (this.state.body instanceof LayoutSwitcher) {
      this.state.body.state.layouts.forEach((layout) => {
        if (layout instanceof ByFrameRepeater) {
          layout.sort(event.sortBy, event.direction);
        }
      });
    }
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.value_breakdown_sort_change,
      {
        target: 'labels',
        criteria: event.sortBy,
        direction: event.direction,
      }
    );
  };

  private async updateBody(variable: CustomVariable) {
    const ds = await getLokiDatasource(this);

    if (!ds) {
      return;
    }

    const timeRange = sceneGraph.getTimeRange(this).state.value;
    const filters = sceneGraph.lookupVariable(VAR_LABELS, this)! as AdHocFiltersVariable;
    let detectedLabels: DetectedLabel[] | undefined = undefined;

    try {
      const response = await ds.getResource<DetectedLabelsResponse>(
        'detected_labels',
        {
          query: filters.state.filterExpression,
          start: timeRange.from.utc().toISOString(),
          end: timeRange.to.utc().toISOString(),
        },
        {
          headers: {
            'X-Query-Tags': `Source=${PLUGIN_ID}`,
          },
        }
      );
      detectedLabels = response?.detectedLabels;
    } catch (error) {
      console.error(error);
      this.setState({ loading: false, error: true });
      return;
    }

    console.log('detectedLables', detectedLabels);

    if (!detectedLabels || !Array.isArray(detectedLabels)) {
      this.setState({ loading: false, error: true });
      return;
    }

    const labels = detectedLabels.sort((a, b) => sortLabelsByCardinality(a, b)).map((l) => l.label);
    const options = getLabelOptions(labels);

    const stateUpdate: Partial<LabelBreakdownSceneState> = {
      loading: false,
      value: String(variable.state.value),
      labels: options, // this now includes "all" and possibly LEVEL_VARIABLE_VALUE structured metadata
      blockingMessage: undefined,
      error: false,
    };

    stateUpdate.body = variable.hasAllValue() ? buildLabelsLayout(options) : buildLabelValuesLayout(variable);

    stateUpdate.search = new BreakdownSearchScene();

    this.setState(stateUpdate);
  }

  public onChange = (value?: string) => {
    if (!value) {
      return;
    }

    const variable = this.getVariable();
    variable.changeValueTo(value);

    const { sortBy, direction } = getSortByPreference('labels', ReducerID.stdDev, 'desc');
    reportAppInteraction(
      USER_EVENTS_PAGES.service_details,
      USER_EVENTS_ACTIONS.service_details.select_field_in_breakdown_clicked,
      {
        label: value,
        previousLabel: variable.getValueText(),
        view: 'labels',
        sortBy,
        sortByDirection: direction,
      }
    );
  };

  public static Component = ({ model }: SceneComponentProps<LabelBreakdownScene>) => {
    const { labels, body, loading, value, blockingMessage, error, search, sort } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.container}>
        <StatusWrapper {...{ isLoading: loading, blockingMessage }}>
          <div className={styles.controls}>
            {body instanceof LayoutSwitcher && <body.Selector model={body} />}
            {!loading && value !== ALL_VARIABLE_VALUE && (
              <>
                <sort.Component model={sort} />
                <search.Component model={search} />
              </>
            )}
            {!loading && labels.length > 0 && (
              <FieldSelector label="Label" options={labels} value={value} onChange={model.onChange} />
            )}
          </div>
          {error && (
            <Alert title="" severity="warning">
              The labels are not available at this moment. Try using a different time range or check again later.
            </Alert>
          )}
          <div className={styles.content}>{body && <body.Component model={body} />}</div>
        </StatusWrapper>
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      flexGrow: 1,
      display: 'flex',
      minHeight: '100%',
      flexDirection: 'column',
    }),
    content: css({
      flexGrow: 1,
      display: 'flex',
      paddingTop: theme.spacing(0),
    }),
    controls: css({
      flexGrow: 0,
      display: 'flex',
      alignItems: 'top',
      justifyContent: 'space-between',
      flexDirection: 'row-reverse',
      gap: theme.spacing(2),
    }),
  };
}

function buildLabelsLayout(options: Array<SelectableValue<string>>) {
  const children: SceneFlexItemLike[] = [];

  for (const option of options) {
    const { value: optionValue } = option;
    if (optionValue === ALL_VARIABLE_VALUE || !optionValue) {
      continue;
    }

    children.push(
      new SceneCSSGridItem({
        body: PanelBuilders.timeseries()
          .setTitle(optionValue)
          .setData(getQueryRunner(buildLokiQuery(getExpr(optionValue), { legendFormat: `{{${optionValue}}}` })))
          .setHeaderActions(new SelectLabelAction({ labelName: String(optionValue) }))
          .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
          .setCustomFieldConfig('fillOpacity', 100)
          .setCustomFieldConfig('lineWidth', 0)
          .setCustomFieldConfig('pointSize', 0)
          .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
          .setOverrides(setLeverColorOverrides)
          .build(),
      })
    );
  }

  return new LayoutSwitcher({
    options: [
      { value: 'grid', label: 'Grid' },
      { value: 'rows', label: 'Rows' },
    ],
    active: 'grid',
    layouts: [
      new SceneCSSGridLayout({
        isLazy: true,
        templateColumns: GRID_TEMPLATE_COLUMNS,
        autoRows: '200px',
        children: children,
      }),
      new SceneCSSGridLayout({
        isLazy: true,
        templateColumns: '1fr',
        autoRows: '200px',
        children: children.map((child) => child.clone()),
      }),
    ],
  });
}

function getExpr(tagKey: string) {
  return `sum(count_over_time(${LOG_STREAM_SELECTOR_EXPR} | drop __error__ | ${tagKey}!="" [$__auto])) by (${tagKey})`;
}

const GRID_TEMPLATE_COLUMNS = 'repeat(auto-fit, minmax(400px, 1fr))';

function buildLabelValuesLayout(variable: CustomVariable) {
  const tagKey = variable.getValueText();
  const query = buildLokiQuery(getExpr(tagKey), { legendFormat: `{{${tagKey}}}` });

  let bodyOpts = PanelBuilders.timeseries();
  bodyOpts = bodyOpts
    .setCustomFieldConfig('stacking', { mode: StackingMode.Normal })
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setCustomFieldConfig('pointSize', 0)
    .setCustomFieldConfig('drawStyle', DrawStyle.Bars)
    .setOverrides(setLeverColorOverrides)
    .setTitle(variable.getValueText());

  const body = bodyOpts.build();
  const { sortBy, direction } = getSortByPreference('labels', ReducerID.stdDev, 'desc');

  return new LayoutSwitcher({
    $data: getQueryRunner(query),
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
          templateColumns: GRID_TEMPLATE_COLUMNS,
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
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
          VAR_LABELS
        ),
        sortBy,
        direction,
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
          query.expr.includes('count_over_time') ? DrawStyle.Bars : DrawStyle.Line,
          VAR_LABELS
        ),
        sortBy,
        direction,
      }),
    ],
  });
}

export function buildLabelBreakdownActionScene() {
  return new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: new LabelBreakdownScene({}),
      }),
    ],
  });
}

interface SelectLabelActionState extends SceneObjectState {
  labelName: string;
}
export class SelectLabelAction extends SceneObjectBase<SelectLabelActionState> {
  public onClick = () => {
    getBreakdownSceneFor(this).onChange(this.state.labelName);
  };

  public static Component = ({ model }: SceneComponentProps<SelectLabelAction>) => {
    return (
      <Button variant="secondary" size="sm" onClick={model.onClick} aria-label={`Select ${model.useState().labelName}`}>
        Select
      </Button>
    );
  };
}

function getBreakdownSceneFor(model: SceneObject): LabelBreakdownScene {
  if (model instanceof LabelBreakdownScene) {
    return model;
  }

  if (model.parent) {
    return getBreakdownSceneFor(model.parent);
  }

  throw new Error('Unable to find breakdown scene');
}
