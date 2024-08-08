import { SceneComponentProps, SceneDataState, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LogsListScene } from './LogsListScene';
import { AdHocVariableFilter, LoadingState } from '@grafana/data';
import { TableProvider } from '../Table/TableProvider';
import React, { useRef } from 'react';
import { PanelChrome } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { css } from '@emotion/css';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { areArraysEqual } from '../../services/comparison';
import { getLogsPanelFrame } from './ServiceScene';

interface LogsTableSceneState extends SceneObjectState {
  data: SceneDataState;
  loading?: LoadingState;
}

export class LogsTableScene extends SceneObjectBase<LogsTableSceneState> {
  constructor(state: Partial<LogsTableSceneState> & { data: SceneDataState }) {
    super(state);

    this.addActivationHandler(this.onActivate.bind(this));
  }

  /**
   * We can't subscribe to the state of the data provider anymore, because there are multiple queries running in each data provider
   * So we need to manually update the data state to prevent unnecessary re-renders that cause flickering and break loading states
   */
  public onActivate() {
    this._subs.add(
      sceneGraph.getData(this).subscribeToState((newState, prevState) => {
        const dataFrame = getLogsPanelFrame(newState.data);

        // Just this query is done
        if (dataFrame) {
          this.setState({
            data: newState,
            loading: newState.data?.state,
          });
        } else {
          // Query is loading
          this.setState({
            loading: newState.data?.state,
          });
        }
      })
    );
  }
  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = getStyles();
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { selectedLine, urlColumns, visualizationType } = parentModel.useState();

    // Get data state
    const { data, loading } = model.useState();

    // Get time range
    const timeRange = sceneGraph.getTimeRange(model);
    const { value: timeRangeValue } = timeRange.useState();

    // Define callback function to update filters in react
    const addFilter = (filter: AdHocVariableFilter) => {
      addAdHocFilter(filter, parentModel);
    };

    // Get reference to panel wrapper so table knows how much space it can use to render
    const panelWrap = useRef<HTMLDivElement>(null);

    // Define callback function to update url columns in react
    const setUrlColumns = (urlColumns: string[]) => {
      if (!areArraysEqual(urlColumns, parentModel.state.urlColumns)) {
        parentModel.setState({ urlColumns });
      }
    };

    const clearSelectedLine = () => {
      if (parentModel.state.selectedLine) {
        parentModel.clearSelectedLine();
      }
    };

    const dataFrame = getLogsPanelFrame(data?.data);

    return (
      <div className={styles.panelWrapper} ref={panelWrap}>
        <PanelChrome
          loadingState={loading}
          title={'Logs'}
          actions={<LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />}
        >
          {dataFrame && (
            <TableProvider
              panelWrap={panelWrap}
              addFilter={addFilter}
              timeRange={timeRangeValue}
              selectedLine={selectedLine}
              urlColumns={urlColumns ?? []}
              setUrlColumns={setUrlColumns}
              dataFrame={dataFrame}
              clearSelectedLine={clearSelectedLine}
            />
          )}
        </PanelChrome>
      </div>
    );
  };
}

const getStyles = () => ({
  panelWrapper: css({
    height: '100%',
  }),
});
