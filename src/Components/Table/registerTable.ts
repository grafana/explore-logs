import { PanelPlugin } from '@grafana/data';
import { TablePanelProps } from '../ServiceScene/LogsTableScene';
import { CustomTableFieldOptions, CustomTablePanel } from './tablePanel';

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
// @todo where is a good place to register stuff?
// sceneUtils.registerRuntimePanelPlugin({ pluginId: 'custom-table-viz', plugin: customTablePanel });
