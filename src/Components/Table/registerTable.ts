import { PanelPlugin } from '@grafana/data';
import { CustomTableFieldOptions, CustomTablePanel } from './tablePanel';
import { TablePanelProps } from '../ServiceScene/LogsListScene';

export const customTablePanel = new PanelPlugin<TablePanelProps, CustomTableFieldOptions>(
  CustomTablePanel
).useFieldConfig({
  useCustomConfig: (builder) => {
    builder.addNumberInput({
      path: 'numericOption',
      name: 'Numeric option',
      description: 'A numeric option',
      defaultValue: 1,
    });
  },
});
