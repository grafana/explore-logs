import { SceneComponentProps, sceneGraph, SceneObjectBase } from '@grafana/scenes';
import { LogsListScene } from './LogsListScene';
import { AdHocVariableFilter } from '@grafana/data';
import { TableProvider } from '../Table/TableProvider';
import React, { useRef } from 'react';
import { PanelChrome } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { css } from '@emotion/css';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { areArraysEqual } from '../../services/comparison';
import { getLogsPanelFrame } from './ServiceScene';
import { getFilterTypeFromLabelType, getLabelTypeFromFrame } from '../../services/fields';
import { LabelType } from '../../services/fieldsTypes';

export class LogsTableScene extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = getStyles();
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { data } = sceneGraph.getData(model).useState();
    const { selectedLine, urlColumns, visualizationType } = parentModel.useState();

    // Get time range
    const timeRange = sceneGraph.getTimeRange(model);
    const { value: timeRangeValue } = timeRange.useState();

    const dataFrame = getLogsPanelFrame(data);

    // Define callback function to update filters in react
    const addFilter = (filter: AdHocVariableFilter) => {
      const { key } = filter;

      const labelType = dataFrame ? getLabelTypeFromFrame(key, dataFrame) : LabelType.Parsed;
      // @todo remove
      if (!labelType) {
        console.warn('Missing label type from frame', { dataFrame, key });
        throw new Error('Missing label type from frame');
      }

      const variableType = getFilterTypeFromLabelType(labelType, key, model);
      addAdHocFilter(filter, parentModel, variableType);
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

    return (
      <div className={styles.panelWrapper} ref={panelWrap}>
        <PanelChrome
          loadingState={data?.state}
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
