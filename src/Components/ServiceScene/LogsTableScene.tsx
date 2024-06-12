import { AdHocFiltersVariable, SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { LogsListScene } from './LogsListScene';
import { VAR_FIELDS, VAR_FILTERS } from '../../services/variables';
import { AdHocVariableFilter } from '@grafana/data';
import { TableProvider } from '../Table/TableProvider';
import React, { useRef } from 'react';
import { PanelChrome } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { css } from '@emotion/css';
import { ServiceScene } from './ServiceScene';

export class LogsTableScene extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { selectedLine, urlColumns, visualizationType } = parentModel.useState();

    // Get dataFrame
    const { data } = sceneGraph.getData(model).useState();

    // Get time range
    const timeRange = sceneGraph.getTimeRange(model);
    const { value: timeRangeValue } = timeRange.useState();

    // Define callback function to update filters in react
    const addFilter = (filter: AdHocVariableFilter) => {
      // Need list of indexed filters
      const serviceScene = sceneGraph.getAncestor(model, ServiceScene);
      const existingIndexedLabels = serviceScene.state.labels?.find((label) => label === filter.key);

      if (existingIndexedLabels) {
        const indexed = sceneGraph.lookupVariable(VAR_FILTERS, model) as AdHocFiltersVariable;
        const filters = indexed.state.filters;
        indexed.setState({
          filters: [...filters, filter],
        });
      } else {
        const fields = sceneGraph.lookupVariable(VAR_FIELDS, model) as AdHocFiltersVariable;
        const filters = fields.state.filters;
        fields.setState({
          filters: [...filters, filter],
        });
      }
    };

    // Get reference to panel wrapper so table knows how much space it can use to render
    const panelWrap = useRef<HTMLDivElement>(null);

    // Define callback function to update url columns in react
    const setUrlColumns = (urlColumns: string[]) => {
      if (JSON.stringify(urlColumns) !== JSON.stringify(parentModel.state.urlColumns)) {
        parentModel.setState({ urlColumns });
      }
    };

    const styles = getStyles();

    return (
      <div className={styles.panelWrapper} ref={panelWrap}>
        <PanelChrome
          loadingState={data?.state}
          title={'Logs'}
          actions={<LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />}
        >
          {data?.series[0] && (
            <TableProvider
              panelWrap={panelWrap}
              addFilter={addFilter}
              timeRange={timeRangeValue}
              selectedLine={selectedLine}
              urlColumns={urlColumns ?? []}
              setUrlColumns={setUrlColumns}
              dataFrame={data?.series[0]}
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
