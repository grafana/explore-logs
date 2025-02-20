import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LogsListScene } from './LogsListScene';
import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import { TableProvider } from '../Table/TableProvider';
import React, { useRef } from 'react';
import { Button, PanelChrome, useStyles2 } from '@grafana/ui';
import { LogsPanelHeaderActions } from '../Table/LogsHeaderActions';
import { css } from '@emotion/css';
import { addAdHocFilter } from './Breakdowns/AddToFiltersButton';
import { areArraysStrictlyEqual } from '../../services/comparison';
import { getLogsPanelFrame } from './ServiceScene';
import { getVariableForLabel } from '../../services/fields';
import { PanelMenu } from '../Panels/PanelMenu';
import { LogLineState } from '../Table/Context/TableColumnsContext';

interface LogsTableSceneState extends SceneObjectState {
  menu?: PanelMenu;
  isColumnManagementActive: boolean;
}
export class LogsTableScene extends SceneObjectBase<LogsTableSceneState> {
  constructor(state: Partial<LogsTableSceneState>) {
    super({ ...state, isColumnManagementActive: false });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public showColumnManagementDrawer = (isActive: boolean) => {
    this.setState({
      isColumnManagementActive: isActive,
    });
  };

  public onActivate() {
    this.setState({
      menu: new PanelMenu({ addInvestigationsLink: false }),
    });
  }
  public static Component = ({ model }: SceneComponentProps<LogsTableScene>) => {
    const styles = useStyles2(getStyles);
    // Get state from parent model
    const parentModel = sceneGraph.getAncestor(model, LogsListScene);
    const { data } = sceneGraph.getData(model).useState();
    const { selectedLine, urlColumns, visualizationType, tableLogLineState } = parentModel.useState();
    const { menu, isColumnManagementActive } = model.useState();

    // Get time range
    const timeRange = sceneGraph.getTimeRange(model);
    const { value: timeRangeValue } = timeRange.useState();

    const dataFrame = getLogsPanelFrame(data);

    // Define callback function to update filters in react
    const addFilter = (filter: AdHocVariableFilter) => {
      const variableType = getVariableForLabel(dataFrame, filter.key, model);
      addAdHocFilter(filter, parentModel, variableType);
    };

    // Get reference to panel wrapper so table knows how much space it can use to render
    const panelWrap = useRef<HTMLDivElement>(null);

    // Define callback function to update url columns in react
    const setUrlColumns = (urlColumns: string[]) => {
      if (!areArraysStrictlyEqual(urlColumns, parentModel.state.urlColumns)) {
        parentModel.setState({ urlColumns });
      }
    };

    const setUrlTableBodyState = (logLineState: LogLineState) => {
      parentModel.setState({ tableLogLineState: logLineState });
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
          menu={menu ? <menu.Component model={menu} /> : undefined}
          actions={
            <>
              <Button onClick={() => model.showColumnManagementDrawer(true)} variant={'secondary'} size={'sm'}>
                Manage columns
              </Button>
              <LogsPanelHeaderActions vizType={visualizationType} onChange={parentModel.setVisualizationType} />
            </>
          }
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
              setUrlTableBodyState={setUrlTableBodyState}
              urlTableBodyState={tableLogLineState}
              showColumnManagementDrawer={model.showColumnManagementDrawer}
              isColumnManagementActive={isColumnManagementActive}
            />
          )}
        </PanelChrome>
      </div>
    );
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  panelWrapper: css({
    width: '100%',
    height: '100%',
    label: 'panel-wrapper-table',

    // @todo remove this wrapper and styles when core changes are introduced in 11.5
    // Need more specificity to override core style
    'button.show-on-hover': {
      opacity: 1,
      visibility: 'visible',
      background: 'none',
      '&:hover': {
        background: theme.colors.secondary.shade,
      },
    },
  }),
});
