import { PanelPlugin } from '@grafana/data';
import { CustomTableFieldOptions, CustomTablePanel } from './tablePanel';
import { TablePanelProps } from '../ServiceScene/LogsListScene';

export const customTablePanel = new PanelPlugin<TablePanelProps, CustomTableFieldOptions>(CustomTablePanel);
